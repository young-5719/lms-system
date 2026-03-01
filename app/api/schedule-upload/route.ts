import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Excel 날짜 변환 (문자열 "2026-02-21" 또는 시리얼 숫자 46084)
function parseExcelDate(val: unknown): string {
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000)
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof val === 'string') {
    return val.trim().slice(0, 10)
  }
  return ''
}

// Excel 시간 변환 (문자열 "13:30" 또는 소수 0.5625)
function parseExcelTime(val: unknown): string {
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (typeof val === 'string' && val.includes(':')) {
    return val.trim().slice(0, 5)
  }
  return ''
}

// 시간 문자열 → 분
function timeToMin(t: string): number {
  if (!t || !t.includes(':')) return 0
  const [h, m] = t.split(':')
  return parseInt(h) * 60 + parseInt(m)
}

interface DailySchedule {
  start_time: string
  end_time: string
  lunch_start: string | null
  lunch_end: string | null
  total_minutes: number
}

// 엑셀 rows → 날짜별 시간표 파싱
function parseScheduleRows(rows: unknown[][]): Map<string, DailySchedule> {
  const byDate = new Map<string, { training: { s: string; e: string }[]; lunch: { s: string; e: string }[] }>()

  for (const row of rows) {
    const type = String(row[1] || '').trim()
    const date = parseExcelDate(row[0])
    const start = parseExcelTime(row[2])
    const end = parseExcelTime(row[3])

    if (!date || !start || !end) continue

    if (!byDate.has(date)) {
      byDate.set(date, { training: [], lunch: [] })
    }

    const entry = byDate.get(date)!
    if (type === '훈련') {
      entry.training.push({ s: start, e: end })
    } else if (type === '점심') {
      entry.lunch.push({ s: start, e: end })
    }
  }

  const result = new Map<string, DailySchedule>()

  for (const [date, { training, lunch }] of byDate) {
    if (training.length === 0) continue

    const startMin = Math.min(...training.map(t => timeToMin(t.s)))
    const endMin = Math.max(...training.map(t => timeToMin(t.e)))
    const totalTrainingMin = training.reduce((acc, t) => acc + (timeToMin(t.e) - timeToMin(t.s)), 0)

    let lunchStart: string | null = null
    let lunchEnd: string | null = null
    if (lunch.length > 0) {
      const ls = Math.min(...lunch.map(l => timeToMin(l.s)))
      const le = Math.max(...lunch.map(l => timeToMin(l.e)))
      lunchStart = `${String(Math.floor(ls / 60)).padStart(2, '0')}:${String(ls % 60).padStart(2, '0')}`
      lunchEnd = `${String(Math.floor(le / 60)).padStart(2, '0')}:${String(le % 60).padStart(2, '0')}`
    }

    const toHHMM = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

    result.set(date, {
      start_time: toHHMM(startMin),
      end_time: toHHMM(endMin),
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      total_minutes: totalTrainingMin,
    })
  }

  return result
}

// GET: 특정 과정의 업로드된 시간표 현황 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = request.nextUrl.searchParams.get('course_id')
    if (!courseId) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('course_daily_schedules')
      .select('training_date, start_time, end_time, lunch_start, lunch_end, total_minutes, uploaded_by, created_at')
      .eq('course_id', courseId)
      .order('training_date', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      count: data?.length ?? 0,
      schedules: data ?? [],
      hasSchedule: (data?.length ?? 0) > 0,
    })
  } catch (e) {
    console.error('schedule-upload GET error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST: 엑셀 시간표 업로드 → 파싱 → DB upsert
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const courseId = formData.get('course_id') as string | null

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    if (!courseId) return NextResponse.json({ error: 'course_id가 없습니다' }, { status: 400 })

    // 과정 존재 확인
    const { data: course } = await supabase
      .from('courses')
      .select('id, course_name, type')
      .eq('id', courseId)
      .single()

    if (!course) return NextResponse.json({ error: '과정을 찾을 수 없습니다' }, { status: 404 })

    // xlsx 파싱
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    // 헤더 행(0번) 제외하고 파싱
    const dataRows = rows.slice(1) as unknown[][]
    const dailyMap = parseScheduleRows(dataRows)

    if (dailyMap.size === 0) {
      return NextResponse.json({ error: '훈련 일정 데이터를 찾을 수 없습니다' }, { status: 400 })
    }

    // DB upsert
    const records = Array.from(dailyMap.entries()).map(([date, sched]) => ({
      course_id: parseInt(courseId),
      training_date: date,
      start_time: sched.start_time,
      end_time: sched.end_time,
      lunch_start: sched.lunch_start,
      lunch_end: sched.lunch_end,
      total_minutes: sched.total_minutes,
      uploaded_by: user.email ?? user.id,
    }))

    const { error: upsertError } = await supabase
      .from('course_daily_schedules')
      .upsert(records, { onConflict: 'course_id,training_date' })

    if (upsertError) throw upsertError

    return NextResponse.json({
      success: true,
      course_name: course.course_name,
      days_uploaded: dailyMap.size,
      message: `${dailyMap.size}일치 시간표가 저장되었습니다`,
    })
  } catch (e) {
    console.error('schedule-upload POST error:', e)
    return NextResponse.json({ error: '업로드 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
