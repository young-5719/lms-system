import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
  NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
}

function timeToDec(t: string): number {
  const parts = t.split(':')
  if (parts.length < 2) return 0
  return parseInt(parts[0]) + parseInt(parts[1]) / 60
}

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

function parseDateString(str: string | null): string | null {
  if (!str) return null
  const match = String(str).match(/(\d{2})\.(\d{2})\.(\d{2})/)
  if (match) return '20' + match[1] + match[2] + match[3]
  return null
}

function parseTimeRangeDuration(str: string | null): number {
  if (!str) return 0
  const s = String(str)
  const parts = s.split('~')
  if (parts.length === 2) {
    const start = timeToDec(parts[0].trim())
    const end = timeToDec(parts[1].trim())
    return end - start
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: courses } = await supabase
      .from('courses')
      .select('instructor, course_name, type, room_number, start_date, end_date, daily_hours, lecture_days, is_weekend, schedule_change, special_lecture_1, special_lecture_1_time, special_lecture_2, special_lecture_2_time')
      .not('instructor', 'is', null)
      .in('type', ['EMPLOYED', 'GENERAL', 'UNEMPLOYED'])
      .gte('end_date', '2026-01-01')
      .lte('start_date', '2026-12-31')
      .order('instructor')

    // 강사별 → 월별 → 과정별 시간 계산 (instructors/page.tsx와 동일 로직)
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
        const excludeInfo: Record<string, number> = {}

        if (course.special_lecture_1) {
          const dateKey = parseDateString(course.special_lecture_1)
          const duration = typeof course.special_lecture_1_time === 'number'
            ? course.special_lecture_1_time
            : parseTimeRangeDuration(String(course.special_lecture_1_time || ''))
          if (dateKey && duration > 0) excludeInfo[dateKey] = (excludeInfo[dateKey] || 0) + duration
        }
        if (course.special_lecture_2) {
          const dateKey = parseDateString(course.special_lecture_2)
          const duration = typeof course.special_lecture_2_time === 'number'
            ? course.special_lecture_2_time
            : parseTimeRangeDuration(String(course.special_lecture_2_time || ''))
          if (dateKey && duration > 0) excludeInfo[dateKey] = (excludeInfo[dateKey] || 0) + duration
        }

        let year = 2026
        if (course.start_date) year = new Date(course.start_date).getFullYear()
        const startMonth = course.start_date ? new Date(course.start_date).getMonth() + 1 : 1

        const regex = /(\d+)월[^\d]*((\d+[\s,\n]*)+)/g
        let match
        while ((match = regex.exec(classDaysText)) !== null) {
          const month = parseInt(match[1])
          const daysChunk = match[2]
          const dayMatches = daysChunk.match(/\d+/g)
          if (!dayMatches) continue

          let calcYear = year
          if (startMonth > 10 && month < 3) calcYear = year + 1
          else if (startMonth < 3 && month > 10) calcYear = year - 1

          if (calcYear !== 2026) continue

          let monthTotalHours = 0
          let monthDayCount = 0

          for (const dayStr of dayMatches) {
            const day = parseInt(dayStr)
            const dateKey = calcYear + ('0' + month).slice(-2) + ('0' + day).slice(-2)
            let hours = getHoursForDate(dateKey, defaultDailyHours, specialText)
            if (excludeInfo[dateKey]) {
              hours -= excludeInfo[dateKey]
              if (hours < 0) hours = 0
            }
            monthTotalHours += hours
            monthDayCount++
          }

          if (monthTotalHours <= 0) continue

          const monthKey = calcYear + '-' + ('0' + month).slice(-2)
          if (!instructorMap.has(instructor)) instructorMap.set(instructor, new Map())
          const monthMap = instructorMap.get(instructor)!
          if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map())
          const courseMap = monthMap.get(monthKey)!
          const existing = courseMap.get(course.course_name) || { hours: 0, days: 0, type: course.type, roomNumber: course.room_number || '-' }
          existing.hours += monthTotalHours
          existing.days += monthDayCount
          courseMap.set(course.course_name, existing)
        }
      }
    }

    // 정리
    const instructors: Array<{
      name: string
      totalHours: number
      monthly: Record<string, { total: number; courses: Array<{ name: string; type: string; roomNumber: string; hours: number; days: number }> }>
    }> = []

    for (const [name, monthMap] of instructorMap) {
      const monthly: Record<string, { total: number; courses: Array<{ name: string; type: string; roomNumber: string; hours: number; days: number }> }> = {}
      let totalHours = 0

      for (const [monthKey, courseMap] of monthMap) {
        let monthTotal = 0
        const courseList = []
        for (const [courseName, data] of courseMap) {
          const rounded = Math.round(data.hours * 10) / 10
          monthTotal += rounded
          courseList.push({ name: courseName, type: data.type, roomNumber: data.roomNumber, hours: rounded, days: data.days })
        }
        monthly[monthKey] = { total: Math.round(monthTotal * 10) / 10, courses: courseList }
        totalHours += monthTotal
      }
      instructors.push({ name, totalHours: Math.round(totalHours * 10) / 10, monthly })
    }
    instructors.sort((a, b) => b.totalHours - a.totalHours)

    const allMonths = Array.from({ length: 12 }, (_, i) => '2026-' + ('0' + (i + 1)).slice(-2))

    // ── 엑셀 생성 ──────────────────────────────────────────────────
    const wb = XLSX.utils.book_new()

    // Sheet 1: 월별 총괄표
    const summaryRows: (string | number)[][] = [
      ['강사', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '합계'],
    ]
    for (const inst of instructors) {
      summaryRows.push([
        inst.name,
        ...allMonths.map(m => inst.monthly[m]?.total || 0),
        inst.totalHours,
      ])
    }
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows)
    ws1['!cols'] = [
      { wch: 14 },
      ...Array(12).fill({ wch: 7 }),
      { wch: 8 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, '월별 총괄')

    // Sheet 2: 상세 내역
    const detailRows: (string | number)[][] = [
      ['강사', '월', '과정명', '구분', '강의실', '수업일수', '수업시간(h)'],
    ]
    for (const inst of instructors) {
      for (const monthKey of allMonths) {
        const md = inst.monthly[monthKey]
        if (!md) continue
        const monthNum = parseInt(monthKey.split('-')[1])
        for (const c of md.courses) {
          detailRows.push([
            inst.name,
            `${monthNum}월`,
            c.name,
            TYPE_LABEL[c.type] || c.type,
            `${c.roomNumber}호`,
            c.days,
            c.hours,
          ])
        }
        // 소계 행
        detailRows.push(['', '', `[${monthNum}월 소계]`, '', '', '', md.total])
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
    ws2['!cols'] = [
      { wch: 14 }, { wch: 6 }, { wch: 42 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(wb, ws2, '상세 내역')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="instructor-hours-2026.xlsx"',
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
