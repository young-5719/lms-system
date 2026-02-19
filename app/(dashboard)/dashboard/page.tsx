import { createClient } from '@/lib/supabase/server'
import StatsCard from '@/components/dashboard/StatsCard'
import OngoingCoursesCard from '@/components/dashboard/OngoingCoursesCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']

export default async function DashboardPage() {
  const supabase = await createClient()

  // 통계 데이터 조회
  const { count: totalCourses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })

  const { data: courses } = await supabase
    .from('courses')
    .select('recruitment_rate, completion_rate, room_number, course_name, type, start_date, end_date, instructor, start_time, end_time, is_weekend, category')
    .order('start_date', { ascending: false })

  // 평균 모집률 계산 (값이 있는 과정만)
  const coursesWithRecruitment = courses?.filter(c => c.recruitment_rate != null && c.recruitment_rate > 0) || []
  const avgRecruitmentRate = coursesWithRecruitment.length > 0
    ? (coursesWithRecruitment.reduce((sum, c) => sum + c.recruitment_rate, 0) / coursesWithRecruitment.length).toFixed(1)
    : '-'

  // 평균 수료율 계산 (값이 있는 과정만)
  const coursesWithCompletion = courses?.filter(c => c.completion_rate != null && c.completion_rate > 0) || []
  const avgCompletionRate = coursesWithCompletion.length > 0
    ? (coursesWithCompletion.reduce((sum, c) => sum + c.completion_rate, 0) / coursesWithCompletion.length).toFixed(1)
    : '-'

  // 진행 중인 과정
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const ongoingCourses = courses ? courses.filter(c => new Date(c.start_date) <= now && new Date(c.end_date) >= now) : []

  // 오늘 19시 이후 빈 강의실 계산
  const dayOfWeek = now.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const eveningStart = timeToMinutes('19:00')

  // 19시 이후에 사용 중인 강의실
  const eveningOccupied = new Map<string, { courseName: string; instructor: string | null; type: string; startTime: string; endTime: string }>()

  if (ongoingCourses) {
    for (const course of ongoingCourses) {
      if (course.is_weekend === 'WEEKDAY' && isWeekend) continue
      if (course.is_weekend === 'WEEKEND' && !isWeekend) continue

      const room = String(course.room_number || '').trim()
      if (!room || !course.end_time) continue

      const courseEnd = timeToMinutes(course.end_time)
      // 19시 이후까지 수업이 있는 강의실만 사용 중으로 표시
      if (courseEnd <= eveningStart) continue

      eveningOccupied.set(room, {
        courseName: course.course_name,
        instructor: course.instructor,
        type: course.type,
        startTime: course.start_time || '',
        endTime: course.end_time || '',
      })
    }
  }

  const emptyRooms = ALL_ROOMS.filter(r => !eveningOccupied.has(r))
  const usedRooms = ALL_ROOMS.filter(r => eveningOccupied.has(r))

  const TYPE_LABEL: Record<string, string> = {
    GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
    NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">학원 운영 현황을 한눈에 확인하세요</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="전체 과정"
          value={totalCourses || 0}
          description="등록된 총 과정 수"
        />
        <OngoingCoursesCard courses={ongoingCourses} />
        <StatsCard
          title="평균 모집률"
          value={avgRecruitmentRate === '-' ? '-' : `${avgRecruitmentRate}%`}
          description={coursesWithRecruitment.length > 0 ? `${coursesWithRecruitment.length}개 과정 기준` : '데이터 없음'}
        />
        <StatsCard
          title="평균 수료율"
          value={avgCompletionRate === '-' ? '-' : `${avgCompletionRate}%`}
          description={coursesWithCompletion.length > 0 ? `${coursesWithCompletion.length}개 과정 기준` : '데이터 없음'}
        />
      </div>

      {/* 오늘의 빈 강의실 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>오늘 19시 이후 강의실 현황</CardTitle>
            <CardDescription>
              {format(now, 'yyyy년 M월 d일')} 기준 {isWeekend ? '(주말)' : '(평일)'} · 19:00 이후 사용 가능 여부
            </CardDescription>
          </div>
          <Link href="/empty-rooms">
            <span className="text-sm text-blue-500 hover:text-blue-700 hover:underline">
              상세보기 →
            </span>
          </Link>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 빈 강의실 */}
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-3">
              사용 가능한 강의실 ({emptyRooms.length}개)
            </h4>
            {emptyRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">빈 강의실이 없습니다</p>
            ) : (
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {emptyRooms.map((room) => (
                  <div
                    key={room}
                    className="p-3 rounded-lg text-center bg-green-50 border-2 border-green-300"
                  >
                    <p className="text-lg font-bold text-green-700">{room}</p>
                    <p className="text-[10px] text-green-500">비어있음</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 사용 중인 강의실 */}
          <div>
            <h4 className="text-sm font-semibold text-red-700 mb-3">
              사용 중인 강의실 ({usedRooms.length}개)
            </h4>
            {usedRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">사용 중인 강의실이 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {usedRooms.map((room) => {
                  const info = eveningOccupied.get(room)!
                  return (
                    <div
                      key={room}
                      className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3"
                    >
                      <div className="text-center bg-red-100 rounded-lg px-3 py-2 flex-shrink-0">
                        <p className="text-lg font-bold text-red-700">{room}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{info.courseName}</p>
                        <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{TYPE_LABEL[info.type] || info.type}</span>
                          <span>|</span>
                          <span>{info.instructor || '-'}</span>
                          <span>|</span>
                          <span>{info.startTime}~{info.endTime}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
