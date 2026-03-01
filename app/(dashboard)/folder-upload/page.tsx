'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, Upload, Trash2, CheckCircle, XCircle, SkipForward } from 'lucide-react'

const FOLDER_TYPE_MAP: Record<string, string> = {
  '근로자': 'EMPLOYED',
  '실업자': 'UNEMPLOYED',
  '일반': 'GENERAL',
}

const FOLDER_LABEL: Record<string, string> = {
  EMPLOYED: '근로자',
  UNEMPLOYED: '실업자',
  GENERAL: '일반',
}

const FOLDER_COLOR: Record<string, string> = {
  EMPLOYED: 'bg-blue-100 text-blue-700',
  UNEMPLOYED: 'bg-green-100 text-green-700',
  GENERAL: 'bg-gray-100 text-gray-700',
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
  recordsSaved: number
}

function getFolderType(relativePath: string): string | null {
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (FOLDER_TYPE_MAP[part]) return FOLDER_TYPE_MAP[part]
  }
  return null
}

function getFolderName(relativePath: string): string {
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (FOLDER_TYPE_MAP[part]) return part
    if (part.includes('과정평가형')) return '과정평가형'
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
    const files = Array.from(e.target.files || []).filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
    const detected: DetectedFile[] = files.map(f => ({
      file: f,
      path: (f as any).webkitRelativePath || f.name,
      folderType: getFolderType((f as any).webkitRelativePath || f.name),
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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleUpload = async () => {
    const uploadable = detectedFiles.filter(f => f.folderType !== null)
    if (uploadable.length === 0) {
      setError('업로드할 수 있는 파일이 없습니다 (근로자/실업자/일반 폴더 파일만 업로드 가능)')
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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 폴더별 파일 수 집계
  const countByFolder = detectedFiles.reduce<Record<string, number>>((acc, f) => {
    acc[f.folderName] = (acc[f.folderName] || 0) + 1
    return acc
  }, {})

  const uploadableCount = detectedFiles.filter(f => f.folderType !== null).length
  const skippedCount = detectedFiles.filter(f => f.folderType === null).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">폴더 추가</h2>
        <p className="text-muted-foreground mt-1">
          훈련 시간표 폴더를 업로드하면 출석부·훈련 주간 달력에서 실제 수업 시간으로 계산합니다
        </p>
      </div>

      {/* 안내 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-medium">폴더 선택</p>
                <p className="text-muted-foreground text-xs">「00. 신도림 전체 시간표」 폴더 전체 선택</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-medium">자동 분류</p>
                <p className="text-muted-foreground text-xs">근로자·실업자·일반 폴더 자동 인식 (과정평가형 제외)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-medium">업로드</p>
                <p className="text-muted-foreground text-xs">과정 자동 매칭 후 DB 저장</p>
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
          // @ts-ignore
          webkitdirectory=""
          className="hidden"
          onChange={handleFolderSelect}
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
              {skippedCount > 0 && <span className="ml-3 text-orange-500">제외됨(과정평가형 등): {skippedCount}개</span>}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {detectedFiles.map((df, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                  {df.folderType ? (
                    <Badge className={`text-[10px] ${FOLDER_COLOR[df.folderType]}`}>
                      {FOLDER_LABEL[df.folderType]}
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-orange-100 text-orange-600">제외</Badge>
                  )}
                  <span className="text-muted-foreground truncate">{df.file.name}</span>
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
                <div className="text-xs text-muted-foreground">매칭 성공</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-600">{result.unmatched.length}</div>
                <div className="text-xs text-muted-foreground">매칭 실패</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <SkipForward className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-orange-500">{result.skipped.length}</div>
                <div className="text-xs text-muted-foreground">제외됨</div>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-muted-foreground">총 <span className="font-medium text-foreground">{result.recordsSaved}일</span>치 시간표 저장 완료</p>

          {/* 매칭 성공 목록 */}
          {result.matched.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-600">✅ 매칭 성공 ({result.matched.length}개)</CardTitle>
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

          {/* 매칭 실패 목록 */}
          {result.unmatched.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-500">❌ 매칭 실패 ({result.unmatched.length}개)</CardTitle>
              </CardHeader>
              <CardContent>
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
