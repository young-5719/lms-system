import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { KOREAN_HOLIDAYS } from '@/lib/holidays'

const TYPE_MULTIPLIER: Record<string, number> = {
  NATIONAL: 0.95,
  UNEMPLOYED: 0.75,
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

    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const { data: courses, error } = await supabase
      .from('courses')
      .select(
        'training_id, course_name, type, instructor, start_date, end_date, tuition, current_students_gov, capacity, day_of_week, lecture_days, holidays, is_weekend'
      )
      .in('type', ['NATIONAL', 'UNEMPLOYED', 'EMPLOYED'])
      .lte('start_date', yearEnd)
      .gte('end_date', yearStart)
      .neq('instructor', '???')

    if (error) throw error

    // ── 연도 내 지급 슬롯 초기화 (달력 상반기 a / 하반기 b) ──────────────────
    const slotMap = new Map<string, SlotData>()

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0')
      const lastDay = new Date(year, m, 0).getDate()
      const nextYear = m === 12 ? year + 1 : year
      const nm = String(m === 12 ? 1 : m + 1).padStart(2, '0')

      slotMap.set(`${year}-${mm}-a`, {
        id: `${year}-${mm}-1`,
        label: `${year}년 ${m}월 상반기`,
        start: `${year}-${mm}-01`,
        end: `${year}-${mm}-15`,
        paymentDate: `${nextYear}-${nm}-05`,
        month: m,
        half: 1,
        courses: [],
      })

      slotMap.set(`${year}-${mm}-b`, {
        id: `${year}-${mm}-2`,
        label: `${year}년 ${m}월 하반기`,
        start: `${year}-${mm}-16`,
        end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
        paymentDate: `${nextYear}-${nm}-20`,
        month: m,
        half: 2,
        courses: [],
      })
    }

    // ── 과정별 단위기간 계산 및 슬롯 배정 ────────────────────────────────────
    for (const course of courses || []) {
      const tuition = course.tuition || 0
      const students = course.current_students_gov ?? course.capacity ?? 0
      if (tuition === 0 || students === 0) continue

      const totalDays = countTrainingDays(course, course.start_date, course.end_date)
      if (totalDays === 0) continue

      const multiplier = TYPE_MULTIPLIER[course.type] ?? 1

      // 개강일 기준 1개월 단위로 단위기간 생성
      const unitPeriods = generateCourseUnitPeriods(course.start_date, course.end_date)

      for (const up of unitPeriods) {
        // 단위기간 종료일이 해당 연도 내인 경우만 집계
        if (up.end < yearStart || up.end > yearEnd) continue

        const periodDays = countTrainingDays(course, up.start, up.end)
        if (periodDays === 0) continue

        const revenue = Math.round(tuition * (periodDays / totalDays) * students * multiplier)

        // 종료일의 일자로 상반기(a) / 하반기(b) 판단
        const endDay = parseInt(up.end.slice(8, 10))
        const endYearMonth = up.end.slice(0, 7)
        const slotKey = `${endYearMonth}-${endDay <= 15 ? 'a' : 'b'}`

        const slot = slotMap.get(slotKey)
        if (!slot) continue

        slot.courses.push({
          trainingId: course.training_id,
          courseName: course.course_name,
          instructor: course.instructor || '',
          type: course.type,
          startDate: course.start_date,
          endDate: course.end_date,
          unitPeriodStart: up.start,
          unitPeriodEnd: up.end,
          periodDays,
          totalDays,
          tuition,
          students,
          multiplier,
          revenue,
        })
      }
    }

    // ── 슬롯별 합계 계산 ────────────────────────────────────────────────────
    const periods = Array.from(slotMap.values()).map((slot) => {
      const totalByType = {
        NATIONAL: slot.courses.filter((c) => c.type === 'NATIONAL').reduce((s, c) => s + c.revenue, 0),
        UNEMPLOYED: slot.courses.filter((c) => c.type === 'UNEMPLOYED').reduce((s, c) => s + c.revenue, 0),
        EMPLOYED: slot.courses.filter((c) => c.type === 'EMPLOYED').reduce((s, c) => s + c.revenue, 0),
      }
      return {
        ...slot,
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface CourseRevenue {
  trainingId: number
  courseName: string
  instructor: string
  type: string
  startDate: string
  endDate: string
  unitPeriodStart: string  // 과정 기준 단위기간 시작일
  unitPeriodEnd: string    // 과정 기준 단위기간 종료일 (이 날짜로 슬롯 결정)
  periodDays: number
  totalDays: number
  tuition: number
  students: number
  multiplier: number
  revenue: number
}

interface SlotData {
  id: string
  label: string
  start: string
  end: string
  paymentDate: string
  month: number
  half: number
  courses: CourseRevenue[]
}

// ── 과정 기준 단위기간 생성 ────────────────────────────────────────────────────
// 개강일 ~ 개강일+1개월-1일 → 개강일+1개월 ~ 개강일+2개월-1일 → ...
function generateCourseUnitPeriods(startDate: string, endDate: string): Array<{ start: string; end: string }> {
  const periods: Array<{ start: string; end: string }> = []
  const courseEnd = new Date(endDate + 'T00:00:00')
  let periodStart = new Date(startDate + 'T00:00:00')

  while (periodStart <= courseEnd) {
    // 단위기간 종료일: 시작일 + 1개월 - 1일
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(periodEnd.getDate() - 1)

    // 과정 종료일 초과 시 캡
    const actualEnd = periodEnd > courseEnd ? new Date(courseEnd) : periodEnd

    periods.push({ start: toDateStr(periodStart), end: toDateStr(actualEnd) })

    // 다음 단위기간 시작일: periodEnd + 1 (과정 종료일 기준이 아닌 월 경계 기준)
    const nextStart = new Date(periodEnd)
    nextStart.setDate(nextStart.getDate() + 1)
    periodStart = nextStart
  }

  return periods
}

function toDateStr(d: Date): string {
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

// ── 수업일수 계산 ──────────────────────────────────────────────────────────────

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

  if (course.lecture_days) {
    const lectureSet = parseLectureDates(course.lecture_days, course.start_date)
    let count = 0
    for (const d of lectureSet) {
      if (d >= effectiveStart && d <= effectiveEnd && !holidaySet.has(d) && !KOREAN_HOLIDAYS[d]) count++
    }
    return count
  }

  let courseDays: number[] | null = parseDaysOfWeek(course.day_of_week)
  if (!courseDays) {
    courseDays = course.is_weekend === 'WEEKEND'
      ? [new Date(course.start_date + 'T00:00:00').getDay()]
      : [1, 2, 3, 4, 5]
  }

  let count = 0
  const cur = new Date(effectiveStart + 'T00:00:00')
  const end = new Date(effectiveEnd + 'T00:00:00')
  while (cur <= end) {
    const dateStr = toDateStr(cur)
    if (courseDays.includes(cur.getDay()) && !holidaySet.has(dateStr) && !KOREAN_HOLIDAYS[dateStr]) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
