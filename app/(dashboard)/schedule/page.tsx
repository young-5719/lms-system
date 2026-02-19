import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'

const ROOMS = ['601호', '602호', '603호', '604호', '605호', '606호', '607호', '608호', '609호', '610호']

interface ScheduleItem {
  date: string
  dayOfWeek: string
  time: string
  room: string
  courseName: string
  instructor: string
  notes: string
  isEvening: boolean
}

interface MatrixCell {
  courseName: string
  instructor: string
  isEvening: boolean
  notes: string
}

// lecture_days 파싱: "(1월) 5, 7, 9...(2월) 2, 4..." → Set<"yyyy-MM-dd">
function parseLectureDates(lectureDays: string, startDate: string): Set<string> {
  const dates = new Set<string>()
  const startYear = parseInt(startDate.slice(0, 4))
  let currentYear = startYear
  let prevMonth = 0
  const sectionRegex = /\((\d+)월\)\s*([\d,\s]+)/g
  let match
  while ((match = sectionRegex.exec(lectureDays)) !== null) {
    const month = parseInt(match[1])
    if (prevMonth > 0 && month < prevMonth) currentYear++
    prevMonth = month
    const days = match[2].split(',').map(d => parseInt(d.trim())).filter(d => d >= 1 && d <= 31)
    for (const day of days) {
      dates.add(`${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return dates
}

// 한국어 요일 문자열 → JS getDay() 숫자 배열
function parseDaysOfWeek(daysStr: string | null | undefined): number[] | null {
  if (!daysStr) return null
  const s = daysStr.trim()
  if (/월.?금/.test(s) || s === '평일') return [1, 2, 3, 4, 5]
  const dayMap: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 }
  const days: number[] = []
  for (const char of s) {
    if (dayMap[char] !== undefined && !days.includes(dayMap[char])) days.push(dayMap[char])
  }
  return days.length > 0 ? days : null
}

export default async function SchedulePage() {
  const supabase = await createClient()

  // 현재 날짜 이후의 모든 과정 조회
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .gte('end_date', today)
    .order('start_date', { ascending: true })

  // 리스트 뷰 데이터 생성
  const scheduleList: ScheduleItem[] = []

  if (courses) {
    for (const course of courses) {
      const startDate = parseISO(course.start_date)
      const endDate = parseISO(course.end_date)

      // 시작 시간으로 야간 여부 판단 (19:00 이후)
      const isEvening = course.start_time ? course.start_time >= '19:00' : false

      // lecture_days 미리 파싱 (있는 경우)
      const lectureDateSet = course.lecture_days
        ? parseLectureDates(course.lecture_days, course.start_date)
        : null

      // 과정 기간 내의 모든 날짜에 대해 스케줄 생성
      let currentDate = startDate
      while (currentDate <= endDate && currentDate <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
        if (isAfter(currentDate, startOfDay(new Date()))) {
          const dateStr = format(currentDate, 'yyyy-MM-dd')
          const dayNum = currentDate.getDay() // 0=일, 6=토
          const isWeekendDay = dayNum === 0 || dayNum === 6

          // 평일/주말 체크 (is_weekend 컬럼 사용)
          if (course.is_weekend === 'WEEKDAY' && isWeekendDay) {
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
            continue
          }
          if (course.is_weekend === 'WEEKEND' && !isWeekendDay) {
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
            continue
          }

          // lecture_days가 있으면 실제 수업 날짜 체크
          if (lectureDateSet && lectureDateSet.size > 0) {
            if (!lectureDateSet.has(dateStr)) {
              currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
              continue
            }
          } else {
            // lecture_days 없으면 day_of_week 요일 패턴 체크
            const courseDays = parseDaysOfWeek(course.day_of_week)
            if (courseDays && !courseDays.includes(dayNum)) {
              currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
              continue
            }
          }

          // 강의실 결정 (change_start_date 기준)
          let room = course.room_number || '-'
          if (course.changed_room && course.change_start_date && dateStr >= course.change_start_date) {
            room = course.changed_room
          }

          let notes = ''
          if (course.changed_room && course.change_start_date && dateStr >= course.change_start_date
              && course.changed_room !== course.room_number) {
            notes = `${course.room_number} → ${course.changed_room}`
          }
          if (course.schedule_change) {
            notes += (notes ? ' | ' : '') + course.schedule_change
          }

          scheduleList.push({
            date: dateStr,
            dayOfWeek: format(currentDate, 'EEE', { locale: ko }),
            time: course.start_time && course.end_time
              ? `${course.start_time}-${course.end_time}`
              : '-',
            room,
            courseName: course.course_name || '-',
            instructor: course.instructor || '-',
            notes,
            isEvening,
          })
        }

        // 다음 날로 이동
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  }

  // 날짜순 정렬
  scheduleList.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  // 매트릭스 뷰 데이터 생성 (날짜 × 강의장)
  const matrixData: Map<string, Map<string, MatrixCell[]>> = new Map()

  scheduleList.forEach(item => {
    if (!matrixData.has(item.date)) {
      matrixData.set(item.date, new Map())
    }
    const dateRow = matrixData.get(item.date)!
    if (!dateRow.has(item.room)) {
      dateRow.set(item.room, [])
    }
    dateRow.get(item.room)!.push({
      courseName: item.courseName,
      instructor: item.instructor,
      isEvening: item.isEvening,
      notes: item.notes,
    })
  })

  // 날짜 목록 (최근 30개 날짜만 표시)
  const uniqueDates = Array.from(new Set(scheduleList.map(item => item.date))).slice(0, 30)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">강의장 현황</h2>
        <p className="text-muted-foreground">강의장별 스케줄을 한눈에 확인하세요</p>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list">리스트 보기</TabsTrigger>
          <TabsTrigger value="matrix">한눈에 보기</TabsTrigger>
        </TabsList>

        {/* 리스트 뷰 */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>강의장 현황 - 리스트</CardTitle>
              <CardDescription>
                총 {scheduleList.length}개의 스케줄 (다음 90일 이내)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">날짜</TableHead>
                      <TableHead className="w-[60px]">요일</TableHead>
                      <TableHead className="w-[120px]">시간</TableHead>
                      <TableHead className="w-[80px]">강의장</TableHead>
                      <TableHead>과정명</TableHead>
                      <TableHead className="w-[100px]">강사</TableHead>
                      <TableHead className="w-[200px]">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          예정된 스케줄이 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      scheduleList.map((item, index) => (
                        <TableRow
                          key={index}
                          className={item.isEvening ? 'bg-yellow-50' : ''}
                        >
                          <TableCell className="font-medium">{item.date}</TableCell>
                          <TableCell>{item.dayOfWeek}</TableCell>
                          <TableCell>{item.time}</TableCell>
                          <TableCell className="font-semibold">{item.room}</TableCell>
                          <TableCell>{item.courseName}</TableCell>
                          <TableCell>{item.instructor}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
                  <span>야간 과정 (19:00 이후)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 매트릭스 뷰 */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>강의장 현황 - 한눈에 보기</CardTitle>
              <CardDescription>
                날짜별 × 강의장별 매트릭스 뷰 (최근 30일)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] sticky left-0 bg-white z-10">날짜</TableHead>
                      <TableHead className="w-[60px] sticky left-[100px] bg-white z-10">요일</TableHead>
                      {ROOMS.map(room => (
                        <TableHead key={room} className="text-center min-w-[150px]">
                          {room}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueDates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="h-24 text-center">
                          예정된 스케줄이 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      uniqueDates.map(date => {
                        const dateRow = matrixData.get(date)
                        const dayOfWeek = format(parseISO(date), 'EEE', { locale: ko })

                        return (
                          <TableRow key={date}>
                            <TableCell className="font-medium sticky left-0 bg-white z-10">
                              {date}
                            </TableCell>
                            <TableCell className="sticky left-[100px] bg-white z-10">
                              {dayOfWeek}
                            </TableCell>
                            {ROOMS.map(room => {
                              const cells = dateRow?.get(room) || []
                              const hasEvening = cells.some(c => c.isEvening)

                              return (
                                <TableCell
                                  key={room}
                                  className={`p-2 text-center ${
                                    cells.length > 0
                                      ? hasEvening
                                        ? 'bg-yellow-100 border-yellow-300'
                                        : 'bg-blue-50 border-blue-200'
                                      : ''
                                  }`}
                                >
                                  {cells.length > 0 ? (
                                    <div className="space-y-1">
                                      {cells.map((cell, idx) => (
                                        <div key={idx} className="text-xs">
                                          <div className="font-semibold truncate" title={cell.courseName}>
                                            {cell.courseName}
                                          </div>
                                          <div className="text-muted-foreground">
                                            {cell.instructor}
                                          </div>
                                          {cell.notes && (
                                            <div className="text-red-600 text-[10px]">
                                              {cell.notes}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
                  <span>주간 과정</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                  <span>야간 과정 (19:00 이후)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
