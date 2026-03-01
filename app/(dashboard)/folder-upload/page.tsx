'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, Upload, Trash2, CheckCircle, XCircle, Calendar } from 'lucide-react'

const FOLDER_TYPE_MAP: Record<string, string> = {
  '근로자': 'EMPLOYED',
  '실업자': 'UNEMPLOYED',
  '일반': 'GENERAL',
  '과정평가형': 'ASSESSMENT',
}

const FOLDER_LABEL: Record<string, string> = {
  EMPLOYED: '근로자',
  UNEMPLOYED: '실업자',
  GENERAL: '일반',
  ASSESSMENT: '과평',
}

const FOLDER_COLOR: Record<string, string> = {
  EMPLOYED: 'bg-blue-100 text-blue-700',
  UNEMPLOYED: 'bg-green-100 text-green-700',
  GENERAL: 'bg-gray-100 text-gray-700',
  ASSESSMENT: 'bg-purple-100 text-purple-700',
}

interface DetectedFile {
  file: File
  path: string
  folderType: string | null
  folderName: string
}

interface UploadResult {
  matched: { filename: string; courseName: string; folderType: string; days: number }[]
  unmatched: { filename: string; reason: string }[]
  skipped: { filename: string; reason: string }[]
  calendarOnly: { filename: string; category: string }[]
  recordsSaved: number
  calendarCourses: number
}

function getFolderType(relativePath: string): string | null {
  const parts = relativePath.split('/')
  for (const part of parts) {
    // 정확한 매칭 우선
    if (FOLDER_TYPE_MAP[part]) return FOLDER_TYPE_MAP[part]
    // 부분 문자열 매칭 (폴더명 변형 대응)
    if (part.includes('과정평가형') || part.includes('과평')) return 'ASSESSMENT'
    if (part.includes('근로자') || part.includes('재직자')) return 'EMPLOYED'
    if (part.includes('실업자')) return 'UNEMPLOYED'
  }
  return null
}

function getFolderName(relativePath: string): string {
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (FOLDER_TYPE_MAP[part]) return part
    if (part.includes('과정평가형') || part.includes('과평')) return '과정평가형'
    if (part.includes('근로자') || part.includes('재직자')) return '근로자'
    if (part.includes('실업자')) return '실업자'
  }
  return parts[parts.length - 2] || '기타'
}

export default function FolderUploadPage() {
  const [detectedFiles, setDetectedFiles] = useState<DetectedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files = Array.from(e.target.files || []).filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
    const detected: DetectedFile[] = files.map(f => ({
      file: f,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path: (f as any).webkitRelativePath || f.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      folderType: getFolderType((f as any).webkitRelativePath || f.name),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      folderName: getFolderName((f as any).webkitRelativePath || f.name),
    }))
    setDetectedFiles(detected)
    setResult(null)
    setError(null)
  }

  const handleDeleteAll = async () => {
    if (!confirm('기존에 저장된 모든 시간표 데이터를 삭제하시겠습니까?')) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/folder-upload', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '삭제 실패')
      alert(data.message)
      setDetectedFiles([])
      setResult(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpload = async () => {
    const uploadable = detectedFiles.filter(f => f.folderType !== null)
    if (uploadable.length === 0) {
      setError('업로드할 수 있는 파일이 없습니다')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      for (const df of detectedFiles) {
        formData.append('files', df.file)
        formData.append('paths', df.path)
      }

      const res = await fetch('/api/folder-upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '업로드 실패')
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const countByFolder = detectedFiles.reduce<Record<string, number>>((acc, f) => {
    acc[f.folderName] = (acc[f.folderName] || 0) + 1
    return acc
  }, {})

  const uploadableCount = detectedFiles.filter(f => f.folderType !== null).length
  const unknownCount = detectedFiles.filter(f => f.folderType === null).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">폴더 추가</h2>
        <p className="text-muted-foreground mt-1">
          훈련 시간표 폴더를 업로드하면 출석부·훈련 주간 달력에 반영됩니다
        </p>
      </div>

      {/* 안내 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-700 shrink-0 mt-0.5">근로자</Badge>
              <div>
                <p className="font-medium">출석부 + 훈련 주간 달력</p>
                <p className="text-muted-foreground text-xs">과정 DB 자동 매칭 후 분단위 출석 계산에 사용</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex gap-1 shrink-0 mt-0.5">
                <Badge className="bg-green-100 text-green-700">실업자</Badge>
                <Badge className="bg-gray-100 text-gray-700">일반</Badge>
                <Badge className="bg-purple-100 text-purple-700">과평</Badge>
              </div>
              <div>
                <p className="font-medium">훈련 주간 달력만</p>
                <p className="text-muted-foreground text-xs">NCS 종료·강사 변경 등 특이사항 표시</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 폴더 선택 + 초기화 */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={handleFolderSelect}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ webkitdirectory: '', directory: '' } as any)}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          폴더 선택
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteAll}
          disabled={deleting || uploading}
          className="flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? '삭제 중...' : '기존 데이터 전체 삭제'}
        </Button>
      </div>

      {/* 선택된 파일 미리보기 */}
      {detectedFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>감지된 파일 ({detectedFiles.length}개)</span>
              <div className="flex gap-2 text-sm font-normal flex-wrap">
                {Object.entries(countByFolder).map(([folder, count]) => (
                  <Badge key={folder} className={FOLDER_COLOR[FOLDER_TYPE_MAP[folder] ?? ''] ?? 'bg-orange-100 text-orange-700'}>
                    {folder} {count}개
                  </Badge>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-3">
              업로드 가능: <span className="text-foreground font-medium">{uploadableCount}개</span>
              {unknownCount > 0 && <span className="ml-3 text-orange-500">미인식: {unknownCount}개</span>}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {detectedFiles.map((df, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                  {df.folderType ? (
                    <Badge className={`text-[10px] ${FOLDER_COLOR[df.folderType]}`}>
                      {FOLDER_LABEL[df.folderType]}
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-orange-100 text-orange-600">미인식</Badge>
                  )}
                  <span className="text-muted-foreground truncate">{df.file.name}</span>
                  {!df.folderType && (
                    <span className="text-[10px] text-orange-400 truncate ml-1">{df.path}</span>
                  )}
                </div>
              ))}
            </div>
            <Button
              className="mt-4 flex items-center gap-2 w-full sm:w-auto"
              onClick={handleUpload}
              disabled={uploading || uploadableCount === 0}
            >
              <Upload className="w-4 h-4" />
              {uploading ? '업로드 중...' : `${uploadableCount}개 파일 업로드`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* 업로드 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 요약 */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-600">{result.matched.length}</div>
                <div className="text-xs text-muted-foreground">출석부 매칭</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <Calendar className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-purple-600">{result.calendarCourses}</div>
                <div className="text-xs text-muted-foreground">훈련 달력 과정</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-600">{result.unmatched.length}</div>
                <div className="text-xs text-muted-foreground">매칭 실패</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>출석부: <span className="font-medium text-foreground">{result.recordsSaved}일</span>치 저장</span>
            <span>달력 전용: <span className="font-medium text-foreground">{result.calendarOnly.length}개</span> 파일 (실업자·일반·과평)</span>
          </div>

          {/* 매칭 성공 목록 (근로자 → 출석부) */}
          {result.matched.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-600">✅ 출석부 매칭 성공 ({result.matched.length}개)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {result.matched.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                      <Badge className={`text-[10px] ${FOLDER_COLOR[m.folderType]}`}>{FOLDER_LABEL[m.folderType]}</Badge>
                      <span className="font-medium truncate flex-1">{m.courseName}</span>
                      <span className="text-muted-foreground shrink-0">{m.days}일</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 달력 전용 (실업자/일반/과정평가형) */}
          {result.calendarOnly.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-purple-600">📅 훈련 주간 달력 전용 ({result.calendarOnly.length}개)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {result.calendarOnly.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                      <Badge className={`text-[10px] ${FOLDER_COLOR[FOLDER_TYPE_MAP[c.category] ?? ''] ?? 'bg-purple-100 text-purple-700'}`}>
                        {c.category}
                      </Badge>
                      <span className="truncate flex-1 text-muted-foreground">{c.filename}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 매칭 실패 목록 */}
          {result.unmatched.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-500">❌ 출석부 매칭 실패 ({result.unmatched.length}개)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">과정 DB에서 강의실+개강일이 일치하는 과정을 찾지 못했습니다</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {result.unmatched.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                      <span className="truncate flex-1 text-muted-foreground">{u.filename}</span>
                      <span className="text-red-500 shrink-0">{u.reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
