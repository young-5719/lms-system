import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// 폴더명 → course type 매핑 (과정평가형은 스킵)
const FOLDER_TYPE_MAP: Record<string, string> = {
  '근로자': 'EMPLOYED',
  '실업자': 'UNEMPLOYED',
  '일반': 'GENERAL',
}

// webkitRelativePath에서 폴더 타입 추출
// 예: "00. 신도림 전체 시간표/근로자/파일명.xlsx" → "EMPLOYED"
function getFolderType(relativePath: string): string | null {
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (FOLDER_TYPE_MAP[part]) return FOLDER_TYPE_MAP[part]
  }
  return null // 과정평가형 등 → 스킵
}

// "603호(2026)(실습겸용강의실)" → "603호"
function extractRoomNumber(location: string): string {
  return String(location).replace(/\(.*$/, '').trim()
}

// Excel 날짜 변환 (문자열 or 시리얼 숫자)
function parseExcelDate(val: unknown): string {
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  if (typeof val === 'string') return val.trim().slice(0, 10)
  return ''
}

// Excel 시간 변환 (문자열 or 소수)
function parseExcelTime(val: unknown): string {
  if (typeof val === 'number') {
    const totalMin = Math.round(val * 24 * 60)
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
  }
  if (typeof val === 'string' && val.includes(':')) return val.trim().slice(0, 5)
  return ''
}

function timeToMin(t: string): number {
  if (!t || !t.includes(':')) return 0
  const [h, m] = t.split(':')
  return parseInt(h) * 60 + parseInt(m)
}

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// 파일명에서 개강일 추출: "20260221_과정명_강사.xlsx" → "2026-02-21"
function getStartDateFromFilename(filename: string): string | null {
  const m = filename.match(/^(\d{8})_/)
  if (!m) return null
  const d = m[1]
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

// xlsx rows → 날짜별 시간표
interface DaySchedule {
  start_time: string
  end_time: string
  lunch_start: string | null
  lunch_end: string | null
  total_minutes: number
}

function parseScheduleFromRows(rows: unknown[][]): { schedules: Map<string, DaySchedule>; roomNumber: string } {
  const byDate = new Map<string, { training: { s: string; e: string }[]; lunch: { s: string; e: string }[] }>()
  let roomNumber = ''

  for (const row of rows) {
    const type = String(row[1] || '').trim()
    const date = parseExcelDate(row[0])
    const start = parseExcelTime(row[2])
    const end = parseExcelTime(row[3])
    const location = String(row[6] || '')

    if (!date) continue

    // 강의장 번호 추출 (첫 번째 훈련 행에서)
    if (!roomNumber && type === '훈련' && location) {
      roomNumber = extractRoomNumber(location)
    }

    if (!byDate.has(date)) byDate.set(date, { training: [], lunch: [] })
    const entry = byDate.get(date)!

    if (type === '훈련' && start && end) {
      entry.training.push({ s: start, e: end })
    } else if (type === '점심' && start && end) {
      entry.lunch.push({ s: start, e: end })
    }
  }

  const schedules = new Map<string, DaySchedule>()
  for (const [date, { training, lunch }] of byDate) {
    if (training.length === 0) continue
    const startMin = Math.min(...training.map(t => timeToMin(t.s)))
    const endMin = Math.max(...training.map(t => timeToMin(t.e)))
    const totalMin = training.reduce((acc, t) => acc + timeToMin(t.e) - timeToMin(t.s), 0)

    let lunchStart: string | null = null
    let lunchEnd: string | null = null
    if (lunch.length > 0) {
      lunchStart = minToHHMM(Math.min(...lunch.map(l => timeToMin(l.s))))
      lunchEnd = minToHHMM(Math.max(...lunch.map(l => timeToMin(l.e))))
    }

    schedules.set(date, {
      start_time: minToHHMM(startMin),
      end_time: minToHHMM(endMin),
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      total_minutes: totalMin,
    })
  }

  return { schedules, roomNumber }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('course_daily_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error

    return NextResponse.json({ success: true, message: '모든 시간표 데이터가 삭제되었습니다' })
  } catch (e) {
    console.error('folder-upload DELETE error:', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const paths = formData.getAll('paths') as string[]

    if (files.length === 0) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const matched: { filename: string; courseName: string; folderType: string; days: number }[] = []
    const unmatched: { filename: string; reason: string }[] = []
    const skipped: { filename: string; reason: string }[] = []
    const allRecords: object[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = paths[i] || file.name

      // 폴더 타입 확인
      const folderType = getFolderType(path)
      if (!folderType) {
        skipped.push({ filename: file.name, reason: '과정평가형 또는 미지원 폴더' })
        continue
      }

      // 파일명에서 개강일 추출
      const startDateFromName = getStartDateFromFilename(file.name)

      // xlsx 파싱
      let schedules: Map<string, DaySchedule>
      let roomNumber: string
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }).slice(1) as unknown[][]
        const parsed = parseScheduleFromRows(rows)
        schedules = parsed.schedules
        roomNumber = parsed.roomNumber
      } catch {
        unmatched.push({ filename: file.name, reason: 'xlsx 파싱 실패' })
        continue
      }

      if (schedules.size === 0 || !roomNumber) {
        unmatched.push({ filename: file.name, reason: '시간표 데이터 없음' })
        continue
      }

      // 과정 매칭: 개강일 + 강의장으로 조회
      const roomBase = roomNumber.replace('호', '')
      let courseId: number | null = null
      let courseName = ''

      // 1차: 파일명 개강일 + 강의장
      if (startDateFromName) {
        const { data: courses } = await supabase
          .from('courses')
          .select('id, course_name, type')
          .eq('start_date', startDateFromName)
          .like('room_number', `${roomBase}호%`)
          .limit(1)

        if (courses && courses.length > 0) {
          courseId = courses[0].id
          courseName = courses[0].course_name
        }
      }

      // 2차: Excel 첫 번째 훈련일 + 강의장
      if (!courseId) {
        const firstDate = Array.from(schedules.keys()).sort()[0]
        if (firstDate) {
          const { data: courses } = await supabase
            .from('courses')
            .select('id, course_name, type')
            .lte('start_date', firstDate)
            .gte('end_date', firstDate)
            .like('room_number', `${roomBase}호%`)
            .limit(1)

          if (courses && courses.length > 0) {
            courseId = courses[0].id
            courseName = courses[0].course_name
          }
        }
      }

      if (!courseId) {
        unmatched.push({ filename: file.name, reason: `과정 미매칭 (${roomNumber}, ${startDateFromName ?? '날짜미확인'})` })
        continue
      }

      // upsert 레코드 준비
      for (const [date, sched] of schedules) {
        allRecords.push({
          course_id: courseId,
          training_date: date,
          start_time: sched.start_time,
          end_time: sched.end_time,
          lunch_start: sched.lunch_start,
          lunch_end: sched.lunch_end,
          total_minutes: sched.total_minutes,
          uploaded_by: user.email ?? user.id,
        })
      }

      matched.push({ filename: file.name, courseName, folderType, days: schedules.size })
    }

    // 일괄 upsert
    if (allRecords.length > 0) {
      const { error } = await supabase
        .from('course_daily_schedules')
        .upsert(allRecords, { onConflict: 'course_id,training_date' })
      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      total: files.length,
      matched,
      unmatched,
      skipped,
      recordsSaved: allRecords.length,
    })
  } catch (e) {
    console.error('folder-upload POST error:', e)
    return NextResponse.json({ error: '업로드 처리 중 오류 발생' }, { status: 500 })
  }
}
