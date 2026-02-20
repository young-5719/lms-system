'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ROLLOVER_COURSES = [
  '회계1급',
  '세무2급',
  '세무1급',
  '포토샵',
  '일러스트',
  '영상편집',
  '웹코딩',
  '피그마',
  '캐드',
  '스케치업',
  '블렌더',
  '블렌더(고급)',
  'IT자격증',
  '기타',
]

// 과목 카테고리별 색상
const COURSE_COLORS: Record<string, string> = {
  '회계1급':   '#dbeafe', // blue-100
  '세무2급':   '#dbeafe',
  '세무1급':   '#dbeafe',
  '포토샵':    '#fce7f3', // pink-100
  '일러스트':  '#fce7f3',
  '영상편집':  '#fce7f3',
  '웹코딩':    '#dcfce7', // green-100
  '피그마':    '#dcfce7',
  '캐드':      '#fef9c3', // yellow-100
  '스케치업':  '#fef9c3',
  '블렌더':    '#ede9fe', // violet-100
  '블렌더(고급)': '#ede9fe',
  'IT자격증':  '#ffedd5', // orange-100
  '기타':      '#f3f4f6', // gray-100
}

interface CourseInfo {
  trainingId: number
  courseName: string
  instructor: string
  startDate: string
  endDate: string
}

interface Student {
  id: string
  name: string
}

interface UpcomingCourse {
  training_id: number
  course_name: string
  start_date: string
  end_date: string
  instructor: string
  type: string
}

const TYPE_LABEL: Record<string, string> = {
  EMPLOYED: '재직자', UNEMPLOYED: '실업자', NATIONAL: '국기',
  ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특', GENERAL: '일반',
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function RolloverSurveyPage() {
  const [trainingIdInput, setTrainingIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [upcomingCourses, setUpcomingCourses] = useState<UpcomingCourse[]>([])

  useEffect(() => {
    fetch('/api/rollover-survey?upcoming=true')
      .then(r => r.json())
      .then(d => setUpcomingCourses(d.courses ?? []))
      .catch(() => {})
  }, [])

  async function handleSearch() {
    if (!trainingIdInput.trim()) return
    setLoading(true)
    setError(null)
    setCourseInfo(null)
    setStudents([])
    try {
      const res = await fetch(`/api/rollover-survey?trainingId=${trainingIdInput.trim()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '조회 실패')
      setCourseInfo(data.course)
      setStudents(data.students)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6">
      {/* 상단 헤더 - 인쇄 시 숨김 */}
      <div className="no-print">
        <h2 className="text-3xl font-bold tracking-tight">이월희망조사표</h2>
        <p className="text-muted-foreground">종강 예정 과정의 수강생 대상 다음 과정 수요 파악</p>
      </div>

      {/* 종강 임박 과정 - 인쇄 시 숨김 */}
      <Card className="no-print">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>🔔</span> 종강 임박 과정
            <Badge variant="secondary" className="ml-1">{upcomingCourses.length}개</Badge>
            <span className="text-xs font-normal text-muted-foreground">— 종강일 기준 7일 이내</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {upcomingCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">종강 임박 과정이 없습니다.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingCourses.map(c => {
                const days = daysUntil(c.end_date)
                const isToday = days === 0
                const isUrgent = days <= 2
                return (
                  <button
                    key={c.training_id}
                    onClick={() => setTrainingIdInput(String(c.training_id))}
                    className="text-left rounded-lg border p-3 hover:bg-gray-50 transition-colors w-full"
                    style={{ borderColor: isUrgent ? '#fca5a5' : isToday ? '#f97316' : '#e2e8f0' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: isUrgent ? '#dc2626' : '#64748b' }}>
                        {isToday ? '오늘 종강' : `D-${days}`}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                        {TYPE_LABEL[c.type] ?? c.type}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2">{c.course_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.start_date} ~ {c.end_date}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {c.training_id}{c.instructor ? ` · ${c.instructor}` : ''}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 검색 - 인쇄 시 숨김 */}
      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="text-sm font-medium mb-1 block">훈련 ID</label>
              <Input
                type="number"
                placeholder="훈련 ID 입력"
                value={trainingIdInput}
                onChange={e => setTrainingIdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? '조회 중...' : '조회'}
            </Button>
            {courseInfo && (
              <Button variant="outline" onClick={() => window.print()}>
                인쇄
              </Button>
            )}
          </div>
          {loading && (
            <p className="text-sm text-muted-foreground mt-3">
              수강생 목록을 불러오는 중입니다... (과정 기간에 따라 수초~수십초 소요)
            </p>
          )}
          {error && <p className="text-sm text-red-500 mt-3">오류: {error}</p>}
        </CardContent>
      </Card>

      {/* 인쇄 대상 영역 */}
      {courseInfo && (
        <div className="print-area">

          {/* 제목 */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              display: 'inline-block',
              background: '#1e3a5f',
              color: 'white',
              padding: '8px 40px',
              borderRadius: '4px',
              fontSize: '20px',
              fontWeight: 'bold',
              letterSpacing: '4px',
            }}>
              이월 희망 조사표
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>작성일: {today}</div>
          </div>

          {/* 과정 정보 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '13px' }}>
            <tbody>
              <tr>
                <th style={{ background: '#1e3a5f', color: 'white', border: '1px solid #94a3b8', padding: '7px 12px', textAlign: 'left', whiteSpace: 'nowrap', width: '80px' }}>
                  훈련과정
                </th>
                <td style={{ border: '1px solid #94a3b8', padding: '7px 12px', fontWeight: 600, background: 'white' }}>
                  {courseInfo.courseName}
                </td>
                <th style={{ background: '#1e3a5f', color: 'white', border: '1px solid #94a3b8', padding: '7px 12px', textAlign: 'left', whiteSpace: 'nowrap', width: '80px' }}>
                  담당강사
                </th>
                <td style={{ border: '1px solid #94a3b8', padding: '7px 12px', background: 'white' }}>
                  {courseInfo.instructor}
                </td>
              </tr>
              <tr>
                <th style={{ background: '#1e3a5f', color: 'white', border: '1px solid #94a3b8', padding: '7px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  훈련기간
                </th>
                <td colSpan={3} style={{ border: '1px solid #94a3b8', padding: '7px 12px', background: 'white' }}>
                  {courseInfo.startDate} ~ {courseInfo.endDate}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 안내문 */}
          <p style={{ fontSize: '12px', color: '#374151', marginBottom: '12px', lineHeight: '1.6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '8px 12px' }}>
            📌 수료 후 계속 수강하고 싶으신 과정에 <strong>✓</strong> 표시해 주세요. 기타란에는 희망하시는 교육명을 직접 기입해 주시기 바랍니다.
          </p>

          {/* 수강생 표 */}
          {students.length === 0 ? (
            <div className="no-print" style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
              수강생 정보를 불러올 수 없습니다. (HRD-Net 미등록 과정일 수 있습니다)
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    {/* 번호 */}
                    <th style={{
                      border: '1px solid #94a3b8',
                      background: '#1e3a5f',
                      color: 'white',
                      textAlign: 'center',
                      width: '28px',
                      padding: '4px 2px',
                      fontSize: '10px',
                    }}>
                      번호
                    </th>
                    {/* 성명 */}
                    <th style={{
                      border: '1px solid #94a3b8',
                      background: '#1e3a5f',
                      color: 'white',
                      textAlign: 'center',
                      width: '52px',
                      padding: '4px 6px',
                      fontSize: '10px',
                    }}>
                      성명
                    </th>
                    {/* 과정 컬럼 */}
                    {ROLLOVER_COURSES.map(course => (
                      <th
                        key={course}
                        style={{
                          border: '1px solid #94a3b8',
                          background: COURSE_COLORS[course],
                          textAlign: 'center',
                          width: course === '기타' ? '52px' : '30px',
                          height: '90px',
                          padding: 0,
                          verticalAlign: 'middle',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '90px',
                        }}>
                          <span style={{
                            display: 'inline-block',
                            transform: 'rotate(90deg)',
                            whiteSpace: 'nowrap',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#1e293b',
                          }}>
                            {course}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr key={student.id} style={{ background: idx % 2 === 0 ? 'white' : '#f0f7ff' }}>
                      <td style={{ border: '1px solid #94a3b8', textAlign: 'center', color: '#6b7280', height: '28px' }}>
                        {idx + 1}
                      </td>
                      <td style={{ border: '1px solid #94a3b8', textAlign: 'center', fontWeight: 600, padding: '2px 4px' }}>
                        {student.name}
                      </td>
                      {ROLLOVER_COURSES.map(course => (
                        <td
                          key={course}
                          style={{
                            border: '1px solid #94a3b8',
                            textAlign: 'center',
                            height: '28px',
                            background: course === '기타' ? '#fafafa' : undefined,
                          }}
                        />
                      ))}
                    </tr>
                  ))}
                  {/* 빈 행 여유분 */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`empty-${i}`} style={{ background: (students.length + i) % 2 === 0 ? 'white' : '#f0f7ff' }}>
                      <td style={{ border: '1px solid #94a3b8', textAlign: 'center', color: '#d1d5db', height: '28px' }}>
                        {students.length + i + 1}
                      </td>
                      <td style={{ border: '1px solid #94a3b8' }} />
                      {ROLLOVER_COURSES.map(course => (
                        <td key={course} style={{ border: '1px solid #94a3b8', height: '28px' }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 인쇄 스타일 */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { padding: 0; }
          body { background: white; }
          aside, header { display: none !important; }
          main { margin: 0 !important; padding: 16px !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  )
}
