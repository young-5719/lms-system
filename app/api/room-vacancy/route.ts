import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHolidayName } from '@/lib/holidays'
import { format } from 'date-fns'

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']
const YEAR = 2026

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: courses } = await supabase
      .from('courses')
      .select('room_number, changed_room, change_start_date, is_weekend, day_of_week, lecture_days, holidays, start_date, end_date')
      .lte('start_date', `${YEAR}-12-31`)
      .gte('end_date', `${YEAR}-01-01`)

    // 2026년 평일(월~금) 공휴일 제외 날짜 Set 및 월별 분류
    const workingDaySet = new Set<string>()
    const workingDaysByMonth = new Map<string, string[]>()
    for (let m = 1; m <= 12; m++) {
      workingDaysByMonth.set(`${YEAR}-${String(m).padStart(2, '0')}`, [])
    }

    const cur = new Date(`${YEAR}-01-01T00:00:00`)
    const yearEnd = new Date(`${YEAR}-12-31T00:00:00`)
    while (cur <= yearEnd) {
      const dow = cur.getDay()
      if (dow !== 0 && dow !== 6) {
        const dateStr = format(cur, 'yyyy-MM-dd')
        if (!getHolidayName(dateStr)) {
          workingDaySet.add(dateStr)
          workingDaysByMonth.get(dateStr.slice(0, 7))?.push(dateStr)
        }
      }
      cur.setDate(cur.getDate() + 1)
    }

    // 강의실별 수업이 있는 날짜 Set
    const occupiedDates = new Map<string, Set<string>>()
    for (const room of ALL_ROOMS) occupiedDates.set(room, new Set())

    if (courses) {
      for (const course of courses) {
        const classDates = expandClassDates(course, workingDaySet)
        for (const date of classDates) {
          let actualRoom = String(course.room_number || '').trim()
          if (course.changed_room && course.change_start_date && date >= course.change_start_date) {
            actualRoom = String(course.changed_room).trim()
          }
          if (ALL_ROOMS.includes(actualRoom)) {
            occupiedDates.get(actualRoom)?.add(date)
          }
        }
      }
    }

    // 월별 공실률 계산
    const data: Record<string, Record<string, { vacancyRate: number; vacantDays: number; totalDays: number }>> = {}

    for (const room of ALL_ROOMS) {
      data[room] = {}
      const occupied = occupiedDates.get(room)!
      let totalVacant = 0
      let totalWorking = 0

      for (const [monthKey, days] of workingDaysByMonth) {
        const total = days.length
        const vacantDays = days.filter(d => !occupied.has(d)).length
        const rate = total > 0 ? Math.round((vacantDays / total) * 100) : 0
        data[room][monthKey] = { vacancyRate: rate, vacantDays, totalDays: total }
        totalVacant += vacantDays
        totalWorking += total
      }

      const avgRate = totalWorking > 0 ? Math.round((totalVacant / totalWorking) * 100) : 0
      data[room]['average'] = { vacancyRate: avgRate, vacantDays: totalVacant, totalDays: totalWorking }
    }

    const months = Array.from(workingDaysByMonth.keys())
    return NextResponse.json({ months, rooms: ALL_ROOMS, data })
  } catch (error) {
    console.error('Error calculating room vacancy:', error)
    return NextResponse.json({ error: 'Failed to calculate vacancy' }, { status: 500 })
  }
}

interface CourseRow {
  is_weekend: string | null
  day_of_week: string | null
  lecture_days: string | null
  holidays: string | null
  start_date: string
  end_date: string
}

function expandClassDates(course: CourseRow, workingDaySet: Set<string>): string[] {
  const { start_date, end_date, lecture_days, holidays, is_weekend, day_of_week } = course
  if (!start_date || !end_date) return []

  const holidayDates = holidays ? parseHolidayDates(holidays) : new Set<string>()
  const result: string[] = []

  if (lecture_days) {
    const explicitDates = parseLectureDates(lecture_days, start_date)
    for (const d of explicitDates) {
      if (workingDaySet.has(d) && !holidayDates.has(d)) result.push(d)
    }
  } else if (is_weekend !== 'WEEKEND') {
    // 평일 과정만 weekday vacancy 집계
    const courseDayNums = parseDaysOfWeek(day_of_week)
    const startD = new Date(Math.max(
      new Date(start_date + 'T00:00:00').getTime(),
      new Date(`${YEAR}-01-01T00:00:00`).getTime()
    ))
    const endD = new Date(Math.min(
      new Date(end_date + 'T00:00:00').getTime(),
      new Date(`${YEAR}-12-31T00:00:00`).getTime()
    ))

    const current = new Date(startD)
    while (current <= endD) {
      const dateStr = format(current, 'yyyy-MM-dd')
      const dow = current.getDay()
      if (workingDaySet.has(dateStr) && !holidayDates.has(dateStr)) {
        const include = courseDayNums ? courseDayNums.includes(dow) : true
        if (include) result.push(dateStr)
      }
      current.setDate(current.getDate() + 1)
    }
  }

  return result
}

function parseHolidayDates(str: string): Set<string> {
  const dates = new Set<string>()
  const regex = /(\d{2})\/(\d{1,2})\/(\d{1,2})/g
  let match
  while ((match = regex.exec(str)) !== null) {
    const year = 2000 + parseInt(match[1])
    const month = String(parseInt(match[2])).padStart(2, '0')
    const day = String(parseInt(match[3])).padStart(2, '0')
    dates.add(`${year}-${month}-${day}`)
  }
  return dates
}

function parseLectureDates(lectureDays: string, startDate: string): Set<string> {
  const dates = new Set<string>()
  const startYear = parseInt(startDate.slice(0, 4))
  let currentYear = startYear
  let prevMonth = 0
  const regex = /\((\d+)월\)\s*([\d,\s]+)/g
  let match
  while ((match = regex.exec(lectureDays)) !== null) {
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
