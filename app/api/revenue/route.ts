import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KOREAN_HOLIDAYS } from '@/lib/holidays'

const TYPE_MULTIPLIER: Record<string, number> = {
  NATIONAL: 0.95,
  UNEMPLOYED: 0.70,
  EMPLOYED: 0.60,
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const today = new Date().toISOString().slice(0, 10)

    // 선택 연도의 단위기간에 수업이 있는 과정 전체 조회
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const { data: courses, error } = await supabase
      .from('courses')
      .select(
        'training_id, course_name, type, instructor, start_date, end_date, tuition, current_students_gov, capacity, day_of_week, lecture_days, holidays, is_weekend'
      )
      .in('type', ['NATIONAL', 'UNEMPLOYED', 'EMPLOYED'])
      .lte('start_date', yearEnd)   // 해당 연도 내에 시작한 과정
      .gte('end_date', yearStart)   // 해당 연도 내에 수업이 있는 과정
      .neq('instructor', '???')     // 강사 미정 과정 제외

    if (error) throw error

    const unitPeriods = generateUnitPeriods(year)

    const periods = unitPeriods.map((period) => {
      const courseRevenues: CourseRevenue[] = []

      for (const course of courses || []) {
        const tuition = course.tuition || 0
        // col46 = current_students_gov, null이면 capacity로 대체
        const students = course.current_students_gov ?? course.capacity ?? 0
        if (tuition === 0 || students === 0) continue

        // 전체 수업일수 (과정 전체 기간)
        const totalDays = countTrainingDays(course, course.start_date, course.end_date)
        if (totalDays === 0) continue

        // 단위기간 내 수업일수
        const periodDays = countTrainingDays(course, period.start, period.end)
        if (periodDays === 0) continue

        const multiplier = TYPE_MULTIPLIER[course.type] ?? 1
        // 공식: 훈련단가(tuition) × 인원(col46) × 변수 → 단위기간 비율로 배분
        // 단위기간 지급액 = tuition × (단위기간 수업일수 / 전체 수업일수) × 인원 × 변수
        const revenue = Math.round(tuition * (periodDays / totalDays) * students * multiplier)

        courseRevenues.push({
          trainingId: course.training_id,
          courseName: course.course_name,
          instructor: course.instructor || '',
          type: course.type,
          startDate: course.start_date,
          endDate: course.end_date,
          periodDays,
          totalDays,
          tuition,
          students,
          multiplier,
          revenue,
        })
      }

      const totalByType = {
        NATIONAL: courseRevenues.filter((c) => c.type === 'NATIONAL').reduce((s, c) => s + c.revenue, 0),
        UNEMPLOYED: courseRevenues.filter((c) => c.type === 'UNEMPLOYED').reduce((s, c) => s + c.revenue, 0),
        EMPLOYED: courseRevenues.filter((c) => c.type === 'EMPLOYED').reduce((s, c) => s + c.revenue, 0),
      }

      return {
        ...period,
        courses: courseRevenues,
        totalByType,
        total: Object.values(totalByType).reduce((a, b) => a + b, 0),
      }
    })

    const annualByType = {
      NATIONAL: periods.reduce((s, p) => s + p.totalByType.NATIONAL, 0),
      UNEMPLOYED: periods.reduce((s, p) => s + p.totalByType.UNEMPLOYED, 0),
      EMPLOYED: periods.reduce((s, p) => s + p.totalByType.EMPLOYED, 0),
    }

    return NextResponse.json({
      year,
      today,
      periods,
      annualByType,
      annualTotal: Object.values(annualByType).reduce((a, b) => a + b, 0),
    })
  } catch (error) {
    console.error('Revenue API error:', error)
    return NextResponse.json({ error: 'Failed to calculate revenue' }, { status: 500 })
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseRevenue {
  trainingId: number
  courseName: string
  instructor: string
  type: string
  startDate: string
  endDate: string
  periodDays: number   // 단위기간 내 수업일수
  totalDays: number    // 과정 전체 수업일수
  tuition: number
  students: number
  multiplier: number
  revenue: number
}

// ── Unit Period Generation ─────────────────────────────────────────────────────

function generateUnitPeriods(year: number) {
  const periods = []
  for (let month = 1; month <= 12; month++) {
    const mm = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const nm = String(nextMonth).padStart(2, '0')

    periods.push({
      id: `${year}-${mm}-1`,
      label: `${year}년 ${month}월 1~15일`,
      start: `${year}-${mm}-01`,
      end: `${year}-${mm}-15`,
      paymentDate: `${nextYear}-${nm}-05`,
      month,
      half: 1,
    })

    periods.push({
      id: `${year}-${mm}-2`,
      label: `${year}년 ${month}월 16~${lastDay}일`,
      start: `${year}-${mm}-16`,
      end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      paymentDate: `${nextYear}-${nm}-20`,
      month,
      half: 2,
    })
  }
  return periods
}

// ── Training Day Count ─────────────────────────────────────────────────────────

function countTrainingDays(
  course: {
    start_date: string
    end_date: string
    lecture_days: string | null
    day_of_week: string | null
    holidays: string | null
    is_weekend: string
    [key: string]: unknown
  },
  periodStart: string,
  periodEnd: string
): number {
  const effectiveStart = periodStart > course.start_date ? periodStart : course.start_date
  const effectiveEnd = periodEnd < course.end_date ? periodEnd : course.end_date
  if (effectiveStart > effectiveEnd) return 0

  const holidaySet = parseHolidayDates(course.holidays || '')

  // lecture_days(col38)가 있으면 실제 날짜 목록 기준
  if (course.lecture_days) {
    const lectureSet = parseLectureDates(course.lecture_days, course.start_date)
    let count = 0
    for (const d of lectureSet) {
      if (d >= effectiveStart && d <= effectiveEnd && !holidaySet.has(d) && !KOREAN_HOLIDAYS[d]) {
        count++
      }
    }
    return count
  }

  // lecture_days 없으면 요일 패턴으로 계산
  let courseDays: number[] | null = parseDaysOfWeek(course.day_of_week)
  if (!courseDays) {
    if (course.is_weekend === 'WEEKEND') {
      courseDays = [new Date(course.start_date + 'T00:00:00').getDay()]
    } else {
      courseDays = [1, 2, 3, 4, 5]
    }
  }

  let count = 0
  const cur = new Date(effectiveStart + 'T00:00:00')
  const end = new Date(effectiveEnd + 'T00:00:00')
  while (cur <= end) {
    const y = cur.getFullYear()
    const mo = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${d}`
    if (courseDays.includes(cur.getDay()) && !holidaySet.has(dateStr) && !KOREAN_HOLIDAYS[dateStr]) {
      count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 과정별 휴강일 파싱: "26/1/31(토)" 또는 JS Date string 형식 모두 처리 */
function parseHolidayDates(holidaysStr: string): Set<string> {
  const dates = new Set<string>()
  if (!holidaysStr) return dates

  const regex1 = /(\d{2})\/(\d{1,2})\/(\d{1,2})/g
  let m: RegExpExecArray | null
  while ((m = regex1.exec(holidaysStr)) !== null) {
    const year = 2000 + parseInt(m[1])
    dates.add(`${year}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`)
  }

  const monthMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const regex2 = /(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/g
  while ((m = regex2.exec(holidaysStr)) !== null) {
    const month = monthMap[m[1]]
    if (month) dates.add(`${m[3]}-${month}-${String(parseInt(m[2])).padStart(2, '0')}`)
  }

  return dates
}

/** lecture_days 파싱: "(2월) 24, 26, 27\n(3월) 3, 5..." → Set<"yyyy-MM-dd"> */
function parseLectureDates(lectureDays: string, startDate: string): Set<string> {
  const dates = new Set<string>()
  const startYear = parseInt(startDate.slice(0, 4))
  let currentYear = startYear
  let prevMonth = 0
  const regex = /\((\d+)월\)\s*([\d,\s]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(lectureDays)) !== null) {
    const month = parseInt(match[1])
    if (prevMonth > 0 && month < prevMonth) currentYear++
    prevMonth = month
    const days = match[2].split(',').map((d) => parseInt(d.trim())).filter((d) => d >= 1 && d <= 31)
    for (const day of days) {
      dates.add(`${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return dates
}

/** 한국어 요일 문자열 → JS getDay() 배열 */
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
