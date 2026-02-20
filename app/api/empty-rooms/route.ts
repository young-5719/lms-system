import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']

const TIME_SLOTS = [
  { label: '1교시 (09:00~10:00)', start: '09:00', end: '10:00' },
  { label: '2교시 (10:00~11:00)', start: '10:00', end: '11:00' },
  { label: '3교시 (11:00~12:00)', start: '11:00', end: '12:00' },
  { label: '점심 (12:00~13:00)', start: '12:00', end: '13:00' },
  { label: '4교시 (13:00~14:00)', start: '13:00', end: '14:00' },
  { label: '5교시 (14:00~15:00)', start: '14:00', end: '15:00' },
  { label: '6교시 (15:00~16:00)', start: '15:00', end: '16:00' },
  { label: '7교시 (16:00~17:00)', start: '16:00', end: '17:00' },
  { label: '8교시 (17:00~18:00)', start: '17:00', end: '18:00' },
  { label: '야간1 (18:00~19:00)', start: '18:00', end: '19:00' },
  { label: '야간2 (19:00~20:00)', start: '19:00', end: '20:00' },
  { label: '야간3 (20:00~21:00)', start: '20:00', end: '21:00' },
  { label: '야간4 (21:00~22:00)', start: '21:00', end: '22:00' },
]

// GET - 날짜 기반 강의실 현황 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }

    const targetDateObj = new Date(date + 'T00:00:00')
    const dayOfWeek = targetDateObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // 해당 날짜에 진행 중인 과정 조회
    const { data: courses } = await supabase
      .from('courses')
      .select('room_number, changed_room, change_start_date, start_time, end_time, is_weekend, course_name, instructor, type, day_of_week, lecture_days, start_date, schedule_change')
      .lte('start_date', date)
      .gte('end_date', date)

    // 강의실별, 시간대별 사용 현황 매트릭스
    const matrix: Record<string, Record<string, { occupied: boolean; courseName?: string; instructor?: string; type?: string }>> = {}

    for (const room of ALL_ROOMS) {
      matrix[room] = {}
      for (const slot of TIME_SLOTS) {
        matrix[room][slot.start] = { occupied: false }
      }
    }

    if (courses) {
      for (const course of courses) {
        if (course.is_weekend === 'WEEKDAY' && isWeekend) continue
        if (course.is_weekend === 'WEEKEND' && !isWeekend) continue

        // lecture_days(col38)에 실제 수업 날짜 목록이 있으면 우선 사용
        if (course.lecture_days) {
          const validDates = parseLectureDates(course.lecture_days, course.start_date)
          if (!validDates.has(date)) continue
        } else {
          // lecture_days 없으면 day_of_week 요일 패턴으로 체크
          const daysStr = course.day_of_week
          const courseDays = parseDaysOfWeek(daysStr)
          if (courseDays && !courseDays.includes(dayOfWeek)) continue
        }

        // change_start_date 이전이면 원래 강의실, 이후면 변경된 강의실 사용
        let actualRoom = String(course.room_number || '').trim()
        if (course.changed_room && course.change_start_date && date >= course.change_start_date) {
          actualRoom = String(course.changed_room).trim()
        }
        if (!actualRoom || !course.start_time || !course.end_time) continue

        // col61 특별 수업시간 적용
        const special = parseSpecialSchedules(course.schedule_change).get(date)
        const courseStart = timeToMinutes(special?.startTime || course.start_time)
        const courseEnd = timeToMinutes(special?.endTime || course.end_time)
        const lunchStartMin = special?.lunchStart ? timeToMinutes(special.lunchStart) : null
        const lunchEndMin = special?.lunchEnd ? timeToMinutes(special.lunchEnd) : null

        for (const slot of TIME_SLOTS) {
          const slotStart = timeToMinutes(slot.start)
          const slotEnd = timeToMinutes(slot.end)
          let isOverlapping = !(courseEnd <= slotStart || courseStart >= slotEnd)

          // 점심시간 구간은 빈 강의실로 처리
          if (isOverlapping && lunchStartMin !== null && lunchEndMin !== null) {
            if (slotStart >= lunchStartMin && slotEnd <= lunchEndMin) isOverlapping = false
          }

          if (isOverlapping && matrix[actualRoom]) {
            matrix[actualRoom][slot.start] = {
              occupied: true,
              courseName: course.course_name,
              instructor: course.instructor,
              type: course.type,
            }
          }
        }
      }
    }

    return NextResponse.json({
      date,
      isWeekend,
      rooms: ALL_ROOMS,
      timeSlots: TIME_SLOTS,
      matrix,
    })
  } catch (error) {
    console.error('Error finding empty rooms:', error)
    return NextResponse.json({ error: 'Failed to find empty rooms' }, { status: 500 })
  }
}

// POST - 기존 호환 유지
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { date, startTime, endTime } = await request.json()

    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: 'date, startTime, and endTime are required' }, { status: 400 })
    }

    const targetDateObj = new Date(date + 'T00:00:00')
    const dayOfWeek = targetDateObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const { data: occupiedCourses } = await supabase
      .from('courses')
      .select('room_number, changed_room, change_start_date, start_time, end_time, is_weekend, day_of_week, lecture_days, start_date')
      .lte('start_date', date)
      .gte('end_date', date)

    const occupiedRooms = new Set<string>()

    if (occupiedCourses) {
      for (const course of occupiedCourses) {
        if (course.is_weekend === 'WEEKDAY' && isWeekend) continue
        if (course.is_weekend === 'WEEKEND' && !isWeekend) continue

        if (course.lecture_days) {
          const validDates = parseLectureDates(course.lecture_days, course.start_date)
          if (!validDates.has(date)) continue
        } else {
          const daysStr = course.day_of_week
          const courseDays = parseDaysOfWeek(daysStr)
          if (courseDays && !courseDays.includes(dayOfWeek)) continue
        }

        let actualRoom = String(course.room_number || '').trim()
        if (course.changed_room && course.change_start_date && date >= course.change_start_date) {
          actualRoom = String(course.changed_room).trim()
        }
        if (!actualRoom || !course.start_time || !course.end_time) continue

        const courseStart = timeToMinutes(course.start_time)
        const courseEnd = timeToMinutes(course.end_time)
        const targetStart = timeToMinutes(startTime)
        const targetEnd = timeToMinutes(endTime)

        if (!(courseEnd <= targetStart || courseStart >= targetEnd)) {
          occupiedRooms.add(actualRoom)
        }
      }
    }

    const emptyRooms = ALL_ROOMS.filter(room => !occupiedRooms.has(room))

    return NextResponse.json({ date, startTime, endTime, emptyRooms, occupiedRooms: Array.from(occupiedRooms) })
  } catch (error) {
    console.error('Error finding empty rooms:', error)
    return NextResponse.json({ error: 'Failed to find empty rooms' }, { status: 500 })
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

// col61 특별 수업시간 파싱: "20241005=09:00~18:00(12:00~13:00), 20241006=10:00~14:00"
interface SpecialScheduleEntry {
  startTime: string
  endTime: string
  lunchStart: string | null
  lunchEnd: string | null
}

function parseSpecialSchedules(scheduleChange: string | null | undefined): Map<string, SpecialScheduleEntry> {
  const result = new Map<string, SpecialScheduleEntry>()
  if (!scheduleChange) return result
  const entries = scheduleChange.split(',').map((e: string) => e.trim()).filter(Boolean)
  for (const entry of entries) {
    const match = entry.match(/^(\d{8})=(\d{1,2}:\d{2})~(\d{1,2}:\d{2})(?:\((\d{1,2}:\d{2})~(\d{1,2}:\d{2})\))?/)
    if (!match) continue
    const rawDate = match[1]
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    result.set(date, {
      startTime: match[2],
      endTime: match[3],
      lunchStart: match[4] || null,
      lunchEnd: match[5] || null,
    })
  }
  return result
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
    // 월이 줄어들면 연도 넘어간 것 (예: 12월 → 1월)
    if (prevMonth > 0 && month < prevMonth) currentYear++
    prevMonth = month

    const days = match[2].split(',').map(d => parseInt(d.trim())).filter(d => d >= 1 && d <= 31)
    for (const day of days) {
      dates.add(`${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return dates
}

// 한국어 요일 문자열 → JS getDay() 숫자 배열 (0=일, 1=월 ... 6=토)
function parseDaysOfWeek(daysStr: string | null | undefined): number[] | null {
  if (!daysStr) return null
  const s = daysStr.trim()

  // 월~금 / 월-금 패턴 (평일 전체)
  if (/월.?금/.test(s) || s === '평일') return [1, 2, 3, 4, 5]

  const dayMap: Record<string, number> = {
    '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0,
  }

  const days: number[] = []
  for (const char of s) {
    if (dayMap[char] !== undefined && !days.includes(dayMap[char])) {
      days.push(dayMap[char])
    }
  }
  return days.length > 0 ? days : null
}
