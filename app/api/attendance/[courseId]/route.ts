import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'
const HRD_URL = 'https://hrd.work24.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_4.jsp'

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0
  const parts = timeStr.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function formatMinToHHMM(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes)
  const isNeg = rounded < 0
  const abs = Math.abs(rounded)
  const h = String(Math.floor(abs / 60)).padStart(2, '0')
  const m = String(abs % 60).padStart(2, '0')
  return (isNeg ? '-' : '') + h + ':' + m
}

function formatTime(t: string | null): string {
  if (!t || String(t).length < 4) return '-'
  const s = String(t).trim()
  if (s.includes(':')) return s.substring(0, 5)
  return s.substring(0, 2) + ':' + s.substring(2, 4)
}

function getMonthList(startStr: string, endStr: string): string[] {
  const months: string[] = []
  const curr = new Date(
    parseInt(startStr.substring(0, 4)),
    parseInt(startStr.substring(4, 6)) - 1,
    1
  )
  const end = new Date(
    parseInt(endStr.substring(0, 4)),
    parseInt(endStr.substring(4, 6)) - 1,
    1
  )
  while (curr <= end) {
    const yyyy = curr.getFullYear()
    const mm = String(curr.getMonth() + 1).padStart(2, '0')
    months.push(yyyy + mm)
    curr.setMonth(curr.getMonth() + 1)
  }
  return months
}

async function fetchMonthlyData(courseCodeId: string, round: string, month: string): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      returnType: 'JSON',
      authKey: AUTH_KEY,
      srchTrprId: courseCodeId,
      srchTrprDegr: round,
      outType: '2',
      srchTorgId: 'student_detail',
      atendMo: month,
    })
    const res = await fetch(`${HRD_URL}?${params}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const text = await res.text()
    if (text.trim().startsWith('<')) return []
    const json = JSON.parse(text)
    if (json.returnJSON) {
      const realData = JSON.parse(json.returnJSON)
      if (realData.atabList) {
        return Array.isArray(realData.atabList) ? realData.atabList : [realData.atabList]
      }
    }
    return []
  } catch (e) {
    console.error('HRD attendance fetch error:', e)
    return []
  }
}

// 특수일정 파싱: "20241005=09:00~18:00(12:00~13:00)" 형태
interface ExceptionSchedule {
  start: number
  end: number
  lunchStart: number
  lunchEnd: number
  hasSpecialLunch: boolean
}

function parseExceptionSchedules(exceptionStr: string | null): Record<string, ExceptionSchedule> {
  const map: Record<string, ExceptionSchedule> = {}
  if (!exceptionStr) return map

  const parts = exceptionStr.split(/[\n,]+/)
  for (const part of parts) {
    const pair = part.split('=')
    if (pair.length !== 2) continue

    const dateKey = pair[0].trim().replace(/[^0-9]/g, '')
    const content = pair[1].trim()

    let specialStart = 0, specialEnd = 0
    let specialLunchS = 0, specialLunchE = 0
    let hasSpecialLunch = false

    if (content.includes('(') && content.includes(')')) {
      const splitLunch = content.split('(')
      const classTimePart = splitLunch[0].trim()
      const lunchTimePart = splitLunch[1].replace(')', '').trim()

      const ct = classTimePart.split('~')
      if (ct.length === 2) {
        specialStart = parseTimeToMinutes(ct[0])
        specialEnd = parseTimeToMinutes(ct[1])
      }
      const lt = lunchTimePart.split('~')
      if (lt.length === 2) {
        specialLunchS = parseTimeToMinutes(lt[0])
        specialLunchE = parseTimeToMinutes(lt[1])
        hasSpecialLunch = true
      }
    } else {
      const ct = content.split('~')
      if (ct.length === 2) {
        specialStart = parseTimeToMinutes(ct[0])
        specialEnd = parseTimeToMinutes(ct[1])
        hasSpecialLunch = true // 점심 없음으로 명시
        specialLunchS = 0
        specialLunchE = 0
      }
    }

    if (specialStart > 0 && specialEnd > 0) {
      map[dateKey] = {
        start: specialStart,
        end: specialEnd,
        lunchStart: specialLunchS,
        lunchEnd: specialLunchE,
        hasSpecialLunch,
      }
    }
  }
  return map
}

// 점심시간 공제 계산
function calcLunchDeduction(startMin: number, endMin: number, lunchS: number, lunchE: number): number {
  if (lunchS <= 0 || lunchE <= lunchS) return 0
  const overlapS = Math.max(startMin, lunchS)
  const overlapE = Math.min(endMin, lunchE)
  return overlapE > overlapS ? overlapE - overlapS : 0
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params
    const { data: course } = await supabase
      .from('courses')
      .select('id, course_name, course_code_id, round, start_date, end_date, start_time, end_time, total_hours, is_weekend, lunch_start, lunch_end, schedule_change')
      .eq('id', courseId)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const isWeekend = course.is_weekend === 'WEEKEND'
    const startDate = course.start_date.replace(/-/g, '')
    const today = new Date()
    const todayStr = today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0')

    const endDateRaw = course.end_date.replace(/-/g, '')
    const effectiveEnd = endDateRaw < todayStr ? endDateRaw : todayStr

    const targetMonths = getMonthList(startDate, effectiveEnd)

    // 월별 데이터 fetch
    let allLogs: any[] = []
    const roundStr = String(course.round || 1)
    for (const m of targetMonths) {
      const logs = await fetchMonthlyData(course.course_code_id, roundStr, m)
      if (logs.length > 0) allLogs = allLogs.concat(logs)
    }

    const validLogs = allLogs.filter(item => {
      const d = String(item.atendDe).trim()
      return d >= startDate && d <= effectiveEnd
    })

    // 기본 수업 시간 설정
    const DEFAULT_START_MIN = parseTimeToMinutes(course.start_time || '19:00')
    const DEFAULT_END_MIN = parseTimeToMinutes(course.end_time || '22:00')
    const DEFAULT_LUNCH_S = parseTimeToMinutes(course.lunch_start || '')
    const DEFAULT_LUNCH_E = parseTimeToMinutes(course.lunch_end || '')

    // 주말반: 특수일정 파싱
    const exceptionMap = isWeekend ? parseExceptionSchedules(course.schedule_change) : {}

    // 수료 기준
    const totalHours = course.total_hours || 0
    const totalCourseMin = totalHours * 60
    const targetCompletionMin = Math.round(totalCourseMin * 0.8)
    const maxAllowableAbsenceMin = Math.round(totalCourseMin * 0.2)

    // 날짜 & 학생 집계
    const dateSet = new Set<string>()
    const studentMap: Record<string, {
      name: string
      logs: Record<string, any>
    }> = {}

    validLogs.forEach(log => {
      dateSet.add(log.atendDe)
      const id = log.trneeCstmrId
      if (!studentMap[id]) {
        studentMap[id] = { name: log.cstmrNm, logs: {} }
      }
      studentMap[id].logs[log.atendDe] = log
    })

    const sortedDates = Array.from(dateSet).sort()
    const sortedStudentIds = Object.keys(studentMap).sort((a, b) =>
      studentMap[a].name.localeCompare(studentMap[b].name)
    )

    // 학생별 출결 계산
    const students = sortedStudentIds.map((id, idx) => {
      const student = studentMap[id]
      let totalMin = 0
      let uncompletedMin = 0
      let attendCount = 0
      let absentCount = 0
      let isDroppedOut = false

      const dailyData: Record<string, { text: string; color: string }> = {}

      for (const date of sortedDates) {
        // 날짜별 기준 시간 결정
        let dailyStartMin = DEFAULT_START_MIN
        let dailyEndMin = DEFAULT_END_MIN
        let dailyLunchS = DEFAULT_LUNCH_S
        let dailyLunchE = DEFAULT_LUNCH_E

        // 특수일정 적용 (주말반)
        if (exceptionMap[date]) {
          dailyStartMin = exceptionMap[date].start
          dailyEndMin = exceptionMap[date].end
          if (exceptionMap[date].hasSpecialLunch) {
            dailyLunchS = exceptionMap[date].lunchStart
            dailyLunchE = exceptionMap[date].lunchEnd
          }
        }

        // 점심 공제 포함 하루 총 수업시간
        const lunchDeduction = calcLunchDeduction(dailyStartMin, dailyEndMin, dailyLunchS, dailyLunchE)
        const DAILY_FULL_MIN = (dailyEndMin - dailyStartMin) - lunchDeduction

        if (isDroppedOut) {
          dailyData[date] = { text: '', color: '#efefef' }
          continue
        }

        const log = student.logs[date]

        if (!log) {
          absentCount++
          uncompletedMin += DAILY_FULL_MIN
          dailyData[date] = { text: '-', color: '#f4c7c3' }
          continue
        }

        const statusCode = String(log.atendSttusCd || '').trim()
        const statusName = String(log.atendSttusNm || '').trim()
        const inTime = formatTime(log.lpsilTime)
        const outTime = formatTime(log.levromTime)

        // 중도탈락
        if (statusCode === '99') {
          isDroppedOut = true
          dailyData[date] = { text: '중도탈락', color: '#ea9999' }
          continue
        }

        // 결석
        if (statusCode === '02' || statusName === '결석') {
          absentCount++
          uncompletedMin += DAILY_FULL_MIN
          dailyData[date] = { text: '결석', color: '#f4c7c3' }
          continue
        }

        // 출석인정 (공가 등)
        if (
          (statusCode === '' && statusName !== '' && statusName !== '결석') ||
          statusCode === '06' || statusCode === '07' || statusCode === '09'
        ) {
          attendCount++
          totalMin += DAILY_FULL_MIN
          dailyData[date] = { text: statusName, color: '#c9daf8' }
          continue
        }

        // 출석 (지각/조퇴 포함)
        if (inTime === '-' || outTime === '-') {
          absentCount++
          uncompletedMin += DAILY_FULL_MIN
          dailyData[date] = { text: '-', color: '#f4c7c3' }
          continue
        }

        attendCount++
        const actualInMin = parseTimeToMinutes(inTime)
        const actualOutMin = parseTimeToMinutes(outTime)

        // 10분 유예 적용
        let recognizedIn = actualInMin
        if (actualInMin <= dailyStartMin + 10) recognizedIn = dailyStartMin

        let recognizedOut = actualOutMin
        if (actualOutMin >= dailyEndMin - 10) recognizedOut = dailyEndMin

        // 체류 시간
        let rawDuration = recognizedOut - recognizedIn

        // 점심시간 공제 (주말반)
        const attendLunchDed = calcLunchDeduction(recognizedIn, recognizedOut, dailyLunchS, dailyLunchE)
        let netTime = rawDuration - attendLunchDed

        if (netTime > DAILY_FULL_MIN) netTime = DAILY_FULL_MIN
        if (netTime < 0) netTime = 0

        const dailyUncompleted = DAILY_FULL_MIN - netTime
        totalMin += netTime
        uncompletedMin += dailyUncompleted

        if (dailyUncompleted === 0) {
          dailyData[date] = { text: 'O', color: '#d9ead3' }
        } else {
          dailyData[date] = { text: `${inTime}\n${outTime}`, color: '#fce8b2' }
        }
      }

      // 최종 판정
      const remainingToComplete = targetCompletionMin - totalMin
      const remainingAbsence = maxAllowableAbsenceMin - uncompletedMin

      const isSuccess = remainingToComplete <= 0
      const isFail = remainingAbsence < 0
      const isWarning = !isFail && !isSuccess && remainingAbsence < 240

      let rowColor: string | null = null
      if (isDroppedOut) rowColor = '#ea9999'
      else if (isSuccess) rowColor = '#d9ead3'
      else if (isFail) rowColor = '#ea9999'
      else if (isWarning) rowColor = '#fce8b2'

      return {
        no: idx + 1,
        name: student.name,
        dailyData,
        remainingComplete: isDroppedOut ? '중도탈락' : isSuccess ? '충족(수료)' : formatMinToHHMM(remainingToComplete),
        uncompleted: formatMinToHHMM(uncompletedMin),
        remainingAbsence: isDroppedOut ? '-' : isFail ? '제적' : formatMinToHHMM(remainingAbsence),
        attendCount,
        absentCount,
        rowColor,
        isDroppedOut,
      }
    })

    return NextResponse.json({
      course: {
        id: course.id,
        name: course.course_name,
        courseCodeId: course.course_code_id,
        round: course.round,
        totalHours: course.total_hours,
        startTime: course.start_time,
        endTime: course.end_time,
        startDate: course.start_date,
        endDate: course.end_date,
        isWeekend,
        lunchStart: course.lunch_start,
        lunchEnd: course.lunch_end,
      },
      dates: sortedDates.map(d => d.substring(4, 6) + '/' + d.substring(6, 8)),
      rawDates: sortedDates,
      students,
      summary: {
        total: students.length,
        success: students.filter(s => s.remainingComplete === '충족(수료)').length,
        fail: students.filter(s => s.remainingAbsence === '제적' || s.isDroppedOut).length,
        warning: students.filter(s => s.rowColor === '#fce8b2').length,
      },
    })
  } catch (error) {
    console.error('Attendance detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}
