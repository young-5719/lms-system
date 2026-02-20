'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

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

export default function RolloverSurveyPage() {
  const [trainingIdInput, setTrainingIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const printRef = useRef<HTMLDivElement>(null)

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

  function handlePrint() {
    window.print()
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6">
      {/* 상단 헤더 - 인쇄 시 숨김 */}
      <div className="no-print">
        <h2 className="text-3xl font-bold tracking-tight">이월희망조사표</h2>
        <p className="text-muted-foreground">
          종강 예정 과정의 수강생 대상 다음 과정 수요 파악
        </p>
      </div>

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
              <Button variant="outline" onClick={handlePrint}>
                인쇄
              </Button>
            )}
          </div>
          {loading && (
            <p className="text-sm text-muted-foreground mt-3">
              수강생 목록을 불러오는 중입니다... (과정 기간에 따라 수초~수십초 소요)
            </p>
          )}
          {error && (
            <p className="text-sm text-red-500 mt-3">오류: {error}</p>
          )}
        </CardContent>
      </Card>

      {/* 인쇄 대상 영역 */}
      {courseInfo && (
        <div ref={printRef} className="print-area">
          {/* 제목 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">이월 희망 조사표</h1>
            <p className="text-sm text-gray-500 mt-1">작성일: {today}</p>
          </div>

          {/* 과정 정보 */}
          <table className="w-full border-collapse border border-gray-400 mb-6 text-sm">
            <tbody>
              <tr>
                <th className="border border-gray-400 bg-gray-100 px-3 py-2 text-left w-24 whitespace-nowrap">훈련과정</th>
                <td className="border border-gray-400 px-3 py-2 font-medium">{courseInfo.courseName}</td>
                <th className="border border-gray-400 bg-gray-100 px-3 py-2 text-left w-24 whitespace-nowrap">담당강사</th>
                <td className="border border-gray-400 px-3 py-2">{courseInfo.instructor}</td>
              </tr>
              <tr>
                <th className="border border-gray-400 bg-gray-100 px-3 py-2 text-left whitespace-nowrap">훈련기간</th>
                <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                  {courseInfo.startDate} ~ {courseInfo.endDate}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 안내문 */}
          <p className="text-sm mb-4 text-gray-700 leading-relaxed">
            수료 후 계속 수강하고 싶으신 과정에 <strong>✓</strong> 표시해 주세요.
            기타란에는 희망하시는 교육명을 직접 기입해 주시기 바랍니다.
          </p>

          {/* 수강생 표 */}
          {students.length === 0 ? (
            <div className="text-center py-8 text-gray-500 no-print">
              수강생 정보를 불러올 수 없습니다. (HRD-Net 미등록 과정일 수 있습니다)
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-400 text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-1 py-2 text-center w-8">번호</th>
                    <th className="border border-gray-400 px-2 py-2 text-center w-20">성명</th>
                    {ROLLOVER_COURSES.map(course => (
                      <th
                        key={course}
                        className="border border-gray-400 px-1 py-2 text-center"
                        style={{ writingMode: 'vertical-rl', minWidth: '28px', height: '80px' }}
                      >
                        {course}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr key={student.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="border border-gray-400 px-1 py-2 text-center text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-400 px-2 py-2 text-center font-medium">
                        {student.name}
                      </td>
                      {ROLLOVER_COURSES.map(course => (
                        <td
                          key={course}
                          className="border border-gray-400 text-center"
                          style={{ minWidth: '28px', height: '32px' }}
                        >
                          {course === '기타' ? (
                            <span className="block w-full" style={{ minWidth: '60px' }} />
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* 빈 행 3개 추가 (추가 작성 여유분) */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border border-gray-400 px-1 py-2 text-center text-gray-300">
                        {students.length + i + 1}
                      </td>
                      <td className="border border-gray-400 px-2 py-2" />
                      {ROLLOVER_COURSES.map(course => (
                        <td key={course} className="border border-gray-400" style={{ minWidth: '28px', height: '32px' }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 하단 서명란 */}
          <div className="mt-8 flex justify-end gap-16 text-sm">
            <div className="text-center">
              <div className="mb-6">담당자</div>
              <div className="border-t border-gray-400 pt-1 w-24">(인)</div>
            </div>
            <div className="text-center">
              <div className="mb-6">팀장</div>
              <div className="border-t border-gray-400 pt-1 w-24">(인)</div>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 스타일 */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { padding: 0; }
          body { background: white; }
          aside, header { display: none !important; }
          main { margin: 0 !important; padding: 20px !important; }
        }
      `}</style>
    </div>
  )
}
