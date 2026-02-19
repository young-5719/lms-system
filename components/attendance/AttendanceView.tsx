'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const TYPE_LABEL: Record<string, string> = {
  EMPLOYED: '재직자', UNEMPLOYED: '실업자', NATIONAL: '국기',
  ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
}

interface CourseItem {
  id: number
  course_name: string
  course_code_id: string
  round: number
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  total_hours: number
  type: string
  instructor: string
  room_number: string
  is_weekend: string
}

interface DailyCell {
  text: string
  color: string
}

interface StudentRow {
  no: number
  name: string
  dailyData: Record<string, DailyCell>
  remainingComplete: string
  uncompleted: string
  remainingAbsence: string
  attendCount: number
  absentCount: number
  rowColor: string | null
  isDroppedOut: boolean
}

interface AttendanceData {
  course: {
    id: number
    name: string
    courseCodeId: string
    round: number
    totalHours: number
    startTime: string
    endTime: string
    startDate: string
    endDate: string
    isWeekend: boolean
    lunchStart: string | null
    lunchEnd: string | null
  }
  dates: string[]
  rawDates: string[]
  students: StudentRow[]
  summary: {
    total: number
    success: number
    fail: number
    warning: number
  }
}

export default function AttendanceView() {
  const [tab, setTab] = useState('ongoing')
  const [courses, setCourses] = useState<{ ongoing: CourseItem[]; ended: CourseItem[]; upcoming: CourseItem[] }>({ ongoing: [], ended: [], upcoming: [] })
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 과정 목록 로드
  useEffect(() => {
    fetch('/api/attendance')
      .then(r => r.json())
      .then(data => {
        setCourses(data)
        setListLoading(false)
      })
      .catch(() => setListLoading(false))
  }, [])

  // 출석 데이터 로드
  const fetchAttendance = useCallback(async (courseId: number) => {
    setLoading(true)
    setError(null)
    setAttendance(null)
    try {
      const res = await fetch(`/api/attendance/${courseId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      const data: AttendanceData = await res.json()
      setAttendance(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectCourse = (id: number) => {
    setSelectedCourse(id)
    fetchAttendance(id)
  }

  const currentList = tab === 'ongoing' ? courses.ongoing : courses.ended

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">출석부</h2>
        <p className="text-muted-foreground">재직자 과정(19:00~) 분단위 출석 현황</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ongoing">
            진행중 ({courses.ongoing.length})
          </TabsTrigger>
          <TabsTrigger value="ended">
            종강 ({courses.ended.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ongoing" className="mt-4">
          <CourseList
            courses={courses.ongoing}
            loading={listLoading}
            selectedId={selectedCourse}
            onSelect={handleSelectCourse}
          />
        </TabsContent>
        <TabsContent value="ended" className="mt-4">
          <CourseList
            courses={courses.ended}
            loading={listLoading}
            selectedId={selectedCourse}
            onSelect={handleSelectCourse}
          />
        </TabsContent>
      </Tabs>

      {/* 로딩 */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            출석 데이터를 불러오는 중... (HRD-Net API 호출, 최대 1~2분 소요)
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-12 text-center text-red-500">
            오류: {error}
          </CardContent>
        </Card>
      )}

      {/* 출석부 */}
      {attendance && !loading && (
        <div className="space-y-4">
          {/* 과정 정보 + 요약 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {attendance.course.isWeekend && (
                  <Badge className="bg-red-100 text-red-700">주말반</Badge>
                )}
                [{attendance.course.courseCodeId}] {attendance.course.name} ({attendance.course.round}회차)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>시간: {attendance.course.startTime}~{attendance.course.endTime}</span>
                {attendance.course.lunchStart && attendance.course.lunchEnd && (
                  <span>점심: {attendance.course.lunchStart}~{attendance.course.lunchEnd}</span>
                )}
                <span>총 {attendance.course.totalHours}시간</span>
                <span>기간: {attendance.course.startDate} ~ {attendance.course.endDate}</span>
              </div>
              <div className="flex gap-3 mt-3">
                <Badge className="bg-gray-200 text-gray-800">전체 {attendance.summary.total}명</Badge>
                <Badge className="bg-green-200 text-green-800">수료충족 {attendance.summary.success}명</Badge>
                <Badge className="bg-yellow-200 text-yellow-800">위험 {attendance.summary.warning}명</Badge>
                <Badge className="bg-red-200 text-red-800">제적/탈락 {attendance.summary.fail}명</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 출석 테이블 */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[75vh]">
                <table className="border-collapse text-xs">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="sticky left-0 z-30 bg-blue-600 text-white border border-blue-700 px-2 py-2 text-center w-[36px]">No</th>
                      <th className="sticky left-[36px] z-30 bg-blue-600 text-white border border-blue-700 px-2 py-2 text-left min-w-[60px]">이름</th>
                      {attendance.dates.map((d, i) => (
                        <th key={i} className="bg-blue-600 text-white border border-blue-700 px-1 py-2 text-center min-w-[52px] whitespace-nowrap">
                          {d}
                        </th>
                      ))}
                      <th className="bg-blue-800 text-white border border-blue-900 px-2 py-2 text-center min-w-[80px] whitespace-nowrap">수료필요</th>
                      <th className="bg-blue-800 text-white border border-blue-900 px-2 py-2 text-center min-w-[72px] whitespace-nowrap">미이수</th>
                      <th className="bg-blue-800 text-white border border-blue-900 px-2 py-2 text-center min-w-[80px] whitespace-nowrap">결석가능</th>
                      <th className="bg-blue-800 text-white border border-blue-900 px-2 py-2 text-center min-w-[48px] whitespace-nowrap">출석</th>
                      <th className="bg-blue-800 text-white border border-blue-900 px-2 py-2 text-center min-w-[48px] whitespace-nowrap">결석</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.students.map((student) => (
                      <tr key={student.no}>
                        <td
                          className="sticky left-0 z-10 border border-gray-300 px-2 py-1.5 text-center font-medium"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.no}
                        </td>
                        <td
                          className="sticky left-[36px] z-10 border border-gray-300 px-2 py-1.5 font-medium whitespace-nowrap"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.name}
                        </td>
                        {attendance.rawDates.map((date, i) => {
                          const cell = student.dailyData[date]
                          if (!cell) return (
                            <td key={i} className="border border-gray-300 px-1 py-1.5 text-center bg-white">-</td>
                          )
                          return (
                            <td
                              key={i}
                              className="border border-gray-300 px-1 py-1 text-center whitespace-pre-line leading-tight"
                              style={{ backgroundColor: cell.color }}
                            >
                              {cell.text}
                            </td>
                          )
                        })}
                        <td
                          className="border border-gray-300 px-2 py-1.5 text-center font-bold whitespace-nowrap"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.remainingComplete}
                        </td>
                        <td
                          className="border border-gray-300 px-2 py-1.5 text-center whitespace-nowrap"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.uncompleted}
                        </td>
                        <td
                          className="border border-gray-300 px-2 py-1.5 text-center font-bold whitespace-nowrap"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.remainingAbsence}
                        </td>
                        <td
                          className="border border-gray-300 px-2 py-1.5 text-center"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.attendCount}
                        </td>
                        <td
                          className="border border-gray-300 px-2 py-1.5 text-center"
                          style={{ backgroundColor: student.rowColor || '#ffffff' }}
                        >
                          {student.absentCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 범례 */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#d9ead3' }} /> 정상출석
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#fce8b2' }} /> 지각/조퇴
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#f4c7c3' }} /> 결석
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#c9daf8' }} /> 출석인정
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#ea9999' }} /> 중도탈락/제적
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#efefef' }} /> 탈락이후
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function CourseList({
  courses,
  loading,
  selectedId,
  onSelect,
}: {
  courses: CourseItem[]
  loading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">과정 목록 로딩 중...</div>
  }

  if (courses.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">해당하는 과정이 없습니다</div>
  }

  return (
    <div className="grid gap-2">
      {courses.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`text-left p-3 rounded-lg border transition-colors ${
            selectedId === c.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {c.is_weekend === 'WEEKEND' && (
                <Badge className="bg-red-100 text-red-700 text-[10px]">주말</Badge>
              )}
              <span className="font-medium text-sm">{c.course_name}</span>
              <span className="text-xs text-muted-foreground">({c.round || 1}회차)</span>
            </div>
            <Badge className="bg-gray-200 text-gray-700 text-xs">
              {TYPE_LABEL[c.type] || c.type}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex gap-3">
            <span>{c.start_date} ~ {c.end_date}</span>
            <span>{c.start_time}~{c.end_time}</span>
            <span>{c.instructor || '-'}</span>
            <span>{c.room_number}호</span>
          </div>
        </button>
      ))}
    </div>
  )
}
