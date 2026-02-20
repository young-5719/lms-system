import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ExportButton from '@/components/instructors/ExportButton'

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
  NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
}

// "09:00" → 9.0 (소수점 시간)
function timeToDec(t: string): number {
  const parts = t.split(':')
  if (parts.length < 2) return 0
  return parseInt(parts[0]) + parseInt(parts[1]) / 60
}

// 특정 날짜의 수업시간 계산 (일정변경 반영)
// specialText 형식: "20260209=09:00~14:00(12:00~13:00)"
function getHoursForDate(dateKey: string, defaultHours: number, specialText: string | null): number {
  if (specialText) {
    const regex = new RegExp(dateKey + '=(\\d{2}:\\d{2})~(\\d{2}:\\d{2})(?:\\((\\d{2}:\\d{2})~(\\d{2}:\\d{2})\\))?')
    const match = specialText.match(regex)
    if (match) {
      const start = timeToDec(match[1])
      const end = timeToDec(match[2])
      const lunchStart = match[3] ? timeToDec(match[3]) : 0
      const lunchEnd = match[4] ? timeToDec(match[4]) : 0
      const duration = (end - start) - (lunchEnd - lunchStart)
      return duration > 0 ? duration : 0
    }
  }
  return defaultHours
}

// "26.02.09(월)" → "20260209"
function parseDateString(str: string | null): string | null {
  if (!str) return null
  const match = String(str).match(/(\d{2})\.(\d{2})\.(\d{2})/)
  if (match) return '20' + match[1] + match[2] + match[3]
  return null
}

// "09:00~14:00" → 5 (시간)
function parseTimeRangeDuration(str: string | null): number {
  if (!str) return 0
  const s = String(str)
  const parts = s.split('~')
  if (parts.length === 2) {
    const start = timeToDec(parts[0].trim())
    const end = timeToDec(parts[1].trim())
    return end - start
  }
  // Float으로 저장된 경우
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

interface MonthCourseDetail {
  name: string
  type: string
  roomNumber: string
  hours: number
  days: number
}

export default async function InstructorsPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('instructor, course_name, type, room_number, start_date, end_date, daily_hours, lecture_days, is_weekend, schedule_change, special_lecture_1, special_lecture_1_time, special_lecture_2, special_lecture_2_time')
    .not('instructor', 'is', null)
    .in('type', ['EMPLOYED', 'GENERAL', 'UNEMPLOYED'])
    .gte('end_date', '2026-01-01')
    .lte('start_date', '2026-12-31')
    .order('instructor')

  // 강사별 → 월별 → 과정별 시간 계산
  // key: "강사명" → "2026-01" → { courseName: hours }
  const instructorMap = new Map<string, Map<string, Map<string, { hours: number; days: number; type: string; roomNumber: string }>>>()

  if (courses) {
    for (const course of courses) {
      const instructor = (course.instructor || '').trim()
      if (!instructor || instructor === '-') continue

      const defaultDailyHours = course.daily_hours || 0
      if (defaultDailyHours <= 0) continue

      const classDaysText = course.lecture_days || ''
      if (!classDaysText.trim()) continue

      const specialText = course.schedule_change || null

      // 제외할 날짜별 시간 (취업특강)
      const excludeInfo: Record<string, number> = {}

      if (course.special_lecture_1) {
        const dateKey = parseDateString(course.special_lecture_1)
        const duration = typeof course.special_lecture_1_time === 'number'
          ? course.special_lecture_1_time
          : parseTimeRangeDuration(String(course.special_lecture_1_time || ''))
        if (dateKey && duration > 0) {
          excludeInfo[dateKey] = (excludeInfo[dateKey] || 0) + duration
        }
      }

      if (course.special_lecture_2) {
        const dateKey = parseDateString(course.special_lecture_2)
        const duration = typeof course.special_lecture_2_time === 'number'
          ? course.special_lecture_2_time
          : parseTimeRangeDuration(String(course.special_lecture_2_time || ''))
        if (dateKey && duration > 0) {
          excludeInfo[dateKey] = (excludeInfo[dateKey] || 0) + duration
        }
      }

      // 개강연도 파악
      let year = 2026
      if (course.start_date) {
        const sd = new Date(course.start_date)
        year = sd.getFullYear()
      }
      const startMonth = course.start_date ? new Date(course.start_date).getMonth() + 1 : 1

      // lecture_days 파싱: "(1월) 3, 10, 17, 24\n(2월) 2, 4, 6..."
      const regex = /(\d+)월[^\d]*((\d+[\s,\n]*)+)/g
      let match
      while ((match = regex.exec(classDaysText)) !== null) {
        const month = parseInt(match[1])
        const daysChunk = match[2]
        const dayMatches = daysChunk.match(/\d+/g)
        if (!dayMatches) continue

        // 연도 보정 (12월 개강 → 1,2월은 다음해)
        let calcYear = year
        if (startMonth > 10 && month < 3) calcYear = year + 1
        else if (startMonth < 3 && month > 10) calcYear = year - 1

        // 2026년만 집계
        if (calcYear !== 2026) continue

        let monthTotalHours = 0
        let monthDayCount = 0

        for (const dayStr of dayMatches) {
          const day = parseInt(dayStr)
          const dateKey = calcYear + ('0' + month).slice(-2) + ('0' + day).slice(-2)

          // 1. 기본 시간 (일정변경 반영)
          let hours = getHoursForDate(dateKey, defaultDailyHours, specialText)

          // 2. 취업특강 시간 차감
          if (excludeInfo[dateKey]) {
            hours -= excludeInfo[dateKey]
            if (hours < 0) hours = 0
          }

          monthTotalHours += hours
          monthDayCount++
        }

        if (monthTotalHours <= 0) continue

        const monthKey = calcYear + '-' + ('0' + month).slice(-2)

        if (!instructorMap.has(instructor)) {
          instructorMap.set(instructor, new Map())
        }
        const monthMap = instructorMap.get(instructor)!
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, new Map())
        }
        const courseMap = monthMap.get(monthKey)!
        const existing = courseMap.get(course.course_name) || { hours: 0, days: 0, type: course.type, roomNumber: course.room_number || '-' }
        existing.hours += monthTotalHours
        existing.days += monthDayCount
        courseMap.set(course.course_name, existing)
      }
    }
  }

  // 데이터 정리
  interface InstructorData {
    name: string
    totalHours: number
    monthly: Record<string, { total: number; courses: MonthCourseDetail[] }>
  }

  const instructors: InstructorData[] = []

  for (const [name, monthMap] of instructorMap) {
    const monthly: Record<string, { total: number; courses: MonthCourseDetail[] }> = {}
    let totalHours = 0

    for (const [monthKey, courseMap] of monthMap) {
      let monthTotal = 0
      const courses: MonthCourseDetail[] = []
      for (const [courseName, data] of courseMap) {
        const rounded = Math.round(data.hours * 10) / 10
        monthTotal += rounded
        courses.push({
          name: courseName,
          type: data.type,
          roomNumber: data.roomNumber,
          hours: rounded,
          days: data.days,
        })
      }
      monthly[monthKey] = { total: Math.round(monthTotal * 10) / 10, courses }
      totalHours += monthTotal
    }

    instructors.push({ name, totalHours: Math.round(totalHours * 10) / 10, monthly })
  }

  instructors.sort((a, b) => b.totalHours - a.totalHours)

  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return '2026-' + ('0' + m).slice(-2)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">강사별 수업시간</h2>
          <p className="text-muted-foreground">
            2026년 재직자·일반·실업자 과정 대상, 일정변경·취업특강 반영
          </p>
        </div>
        <ExportButton />
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 강사 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instructors.length}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">강사 평균 총 수업시간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {instructors.length > 0
                ? (instructors.reduce((s, i) => s + i.totalHours, 0) / instructors.length).toFixed(1)
                : 0}시간
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">집계 기간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2026년</div>
          </CardContent>
        </Card>
      </div>

      {/* 월별 총괄표 */}
      <Card>
        <CardHeader>
          <CardTitle>강사별 월별 수업시간 총괄</CardTitle>
          <CardDescription>단위: 시간 (일정변경 반영, 취업특강 제외)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 whitespace-nowrap">강사</TableHead>
                  {allMonths.map(m => (
                    <TableHead key={m} className="text-center whitespace-nowrap">{parseInt(m.split('-')[1])}월</TableHead>
                  ))}
                  <TableHead className="text-center whitespace-nowrap font-bold bg-gray-50">합계</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructors.map((inst) => (
                  <TableRow key={inst.name}>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium whitespace-nowrap">{inst.name}</TableCell>
                    {allMonths.map(m => {
                      const md = inst.monthly[m]
                      const hours = md?.total || 0
                      return (
                        <TableCell key={m} className="text-center whitespace-nowrap">
                          {hours > 0 ? (
                            <span className={`font-medium ${hours >= 120 ? 'text-red-600' : hours >= 80 ? 'text-orange-600' : 'text-gray-700'}`}>
                              {hours}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center font-bold whitespace-nowrap bg-gray-50">{inst.totalHours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 강사별 상세 */}
      {instructors.map((inst) => (
        <Card key={inst.name}>
          <CardHeader>
            <CardTitle>{inst.name} 강사</CardTitle>
            <CardDescription>총 수업시간: {inst.totalHours}시간</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allMonths.map((monthKey) => {
                const md = inst.monthly[monthKey]
                if (!md) return null
                const monthNum = parseInt(monthKey.split('-')[1])
                return (
                  <div key={monthKey}>
                    <h4 className="text-sm font-semibold mb-2">
                      {monthNum}월
                      <span className="ml-2 text-muted-foreground font-normal">({md.total}시간)</span>
                    </h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>과정명</TableHead>
                            <TableHead>구분</TableHead>
                            <TableHead>강의실</TableHead>
                            <TableHead className="text-right">수업일수</TableHead>
                            <TableHead className="text-right">소계</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {md.courses.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{c.name}</TableCell>
                              <TableCell className="text-sm">{TYPE_LABEL[c.type] || c.type}</TableCell>
                              <TableCell className="text-sm">{c.roomNumber}호</TableCell>
                              <TableCell className="text-right text-sm">{c.days}일</TableCell>
                              <TableCell className="text-right text-sm font-medium">{c.hours}h</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
