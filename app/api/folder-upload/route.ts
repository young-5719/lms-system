import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// 근로자/실업자/일반 → course_daily_schedules (출석부용)
const FOLDER_TYPE_MAP: Record<string, string> = {
  '근로자': 'EMPLOYED',
  '실업자': 'UNEMPLOYED',
  '일반': 'GENERAL',
}

// webkitRelativePath에서 출석부용 폴더 타입 추출 (근로자/실업자/일반만)
function getFolderType(relativePath: string): string | null {
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (FOLDER_TYPE_MAP[part]) return FOLDER_TYPE_MAP[part]
  }
  return null
}

// 훈련 주간 달력용 카테고리명 추출 (과정평가형 포함 전체)
function getTCCategoryName(relativePath: string): string | null {
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (FOLDER_TYPE_MAP[part]) return part               // 근로자, 실업자, 일반
    if (part.includes('과정평가형') || part.includes('과평')) return '과정평가형'
  }
  return null
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

// ─── course_daily_schedules용 파싱 ───────────────────────────────────────────

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

// ─── 훈련 주간 달력용 파싱 ───────────────────────────────────────────────────

interface TCSession {
  start: string
  end: string
  room: string
  courseName?: string
  instructor?: string
}

interface TCDayData {
  minStart: string
  maxEnd: string
  lunchStart: string
  lunchEnd: string
  subjects: string[]
  ncsUnits: string[]
  rooms: string[]
  instructors: string[]
  sessions: TCSession[]
  isDiscretionary: boolean
}

interface TCCourseEntry {
  id: string
  fileName: string
  data: Record<string, TCDayData>
  weeks: string[][]
  alerts: Record<string, string[]>
}

interface TCCategory {
  id: string
  name: string
  courses: TCCourseEntry[]
}

function formatRoomTC(r: string): string {
  const match = r.match(/\d+호/)
  return match ? match[0] : r.replace(/\(.*$/, '').trim()
}

function generateWeeksTC(min: string, max: string): string[][] {
  if (!min || !max || min === '9999-12-31') return []
  const startDate = new Date(min + 'T00:00:00')
  const endDate = new Date(max + 'T00:00:00')
  const firstSunday = new Date(startDate)
  firstSunday.setDate(startDate.getDate() - startDate.getDay())
  const weekList: string[][] = []
  const cur = new Date(firstSunday)
  while (cur <= endDate || cur.getDay() !== 0) {
    if (cur.getDay() === 0) weekList.push([])
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    weekList[weekList.length - 1].push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
    if (cur > endDate && cur.getDay() === 0) break
  }
  return weekList
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processForTrainingCalendar(rawData: Record<string, any>[]): {
  data: Record<string, TCDayData>
  weeks: string[][]
  alerts: Record<string, string[]>
} {
  const grouped: Record<string, TCDayData> = {}
  const subjectDates: Record<string, { start: string; end: string }> = {}
  let globalMin = '9999-12-31'
  let globalMax = '0000-01-01'

  for (const item of rawData) {
    const dateKey = item['훈련일자'] || item['날짜'] || item['date'] || item['일자']
    if (!dateKey) continue
    const dateStr = parseExcelDate(dateKey)
    if (!dateStr || dateStr.length < 10) continue

    if (dateStr < globalMin) globalMin = dateStr
    if (dateStr > globalMax) globalMax = dateStr

    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        minStart: '23:59', maxEnd: '00:00',
        lunchStart: '13:00', lunchEnd: '14:00',
        subjects: [], ncsUnits: [], rooms: [],
        instructors: [], sessions: [], isDiscretionary: false,
      }
    }

    const dayData = grouped[dateStr]
    const type = String(item['구분'] || '').trim()
    const currentStart = parseExcelTime(item['시작시간'])
    const currentEnd = parseExcelTime(item['종료시간'])

    // 점심 행: 점심 시간만 기록하고 세션 추가 안 함
    if (type === '점심' && currentStart && currentEnd) {
      dayData.lunchStart = currentStart
      dayData.lunchEnd = currentEnd
      continue
    }

    if (!currentStart || !currentEnd) continue

    if (currentStart < dayData.minStart) dayData.minStart = currentStart
    if (currentEnd > dayData.maxEnd) dayData.maxEnd = currentEnd

    const sub = String(item['교과목'] || '').trim()
    const ncs = String(item['NCS능력단위'] || '').trim()
    const roomRaw = item['교육장소(강의실)'] || item['교육장소'] || item['강의장'] || item['강의실']
    const room = roomRaw ? formatRoomTC(String(roomRaw)) : '-'
    const instStr = String(item['훈련강사'] || item['강사'] || '').trim()

    if (sub && !dayData.subjects.includes(sub)) dayData.subjects.push(sub)
    if (ncs && !dayData.ncsUnits.includes(ncs)) dayData.ncsUnits.push(ncs)
    if (room && room !== '-' && !dayData.rooms.includes(room)) dayData.rooms.push(room)

    dayData.sessions.push({ start: currentStart, end: currentEnd, room, courseName: sub, instructor: instStr })

    if (instStr) {
      instStr.split(/[,/]/).forEach(n => {
        const t = n.trim()
        if (t && !dayData.instructors.includes(t)) dayData.instructors.push(t)
      })
    }

    if (sub.includes('재량')) dayData.isDiscretionary = true

    if (sub) {
      if (!subjectDates[sub]) subjectDates[sub] = { start: dateStr, end: dateStr }
      if (dateStr < subjectDates[sub].start) subjectDates[sub].start = dateStr
      if (dateStr > subjectDates[sub].end) subjectDates[sub].end = dateStr
    }
  }

  const alerts: Record<string, string[]> = {}
  const addAlert = (d: string, t: string) => {
    if (!alerts[d]) alerts[d] = []
    if (!alerts[d].includes(t)) alerts[d].push(t)
  }

  if (globalMin !== '9999-12-31') {
    addAlert(globalMin, '🚀 개강일')
    addAlert(globalMax, '🏁 종강일')
    Object.entries(subjectDates).forEach(([name, r]) => {
      addAlert(r.start, `📖 [시작] ${name}`)
      addAlert(r.end, `📘 [종료] ${name}`)
    })
  }

  Object.entries(grouped).forEach(([date, day]) => {
    if (day.instructors.length > 1) addAlert(date, '👤 강사 변경')
  })

  return { data: grouped, weeks: generateWeeksTC(globalMin, globalMax), alerts }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('course_daily_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error

    // 훈련 주간 달력 상태도 초기화
    await supabase.from('training_calendar_state').upsert({
      id: 1,
      categories: [],
      active_category: null,
      active_course_id: null,
      expanded_months: [],
      updated_at: new Date().toISOString(),
      updated_by: user.email ?? user.id,
    }, { onConflict: 'id' })

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

    // 근로자 → course_daily_schedules 결과
    const matched: { filename: string; courseName: string; folderType: string; days: number }[] = []
    const unmatched: { filename: string; reason: string }[] = []
    // 인식되지 않은 폴더 (완전히 제외)
    const skipped: { filename: string; reason: string }[] = []
    // 달력 전용 (실업자/일반/과정평가형 → 훈련 주간 달력에만 저장)
    const calendarOnly: { filename: string; category: string }[] = []
    const allRecords: object[] = []

    // 훈련 주간 달력용 카테고리 맵
    const tcCategoryMap: Record<string, TCCategory> = {}

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = paths[i] || file.name

      const folderType = getFolderType(path)        // EMPLOYED / UNEMPLOYED / GENERAL / null
      const tcCatName = getTCCategoryName(path)     // 근로자 / 실업자 / 일반 / 과정평가형 / null

      // 완전히 인식 불가능한 폴더 → 제외
      if (!tcCatName) {
        skipped.push({ filename: file.name, reason: '미지원 폴더' })
        continue
      }

      // xlsx 한 번 읽기 → 두 형식으로 파싱
      let schedules: Map<string, DaySchedule>
      let roomNumber: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let jsonData: Record<string, any>[]
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]

        // 배열 형식 → course_daily_schedules용
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }).slice(1) as unknown[][]
        const parsed = parseScheduleFromRows(rows)
        schedules = parsed.schedules
        roomNumber = parsed.roomNumber

        // 키 형식 → 훈련 주간 달력용
        jsonData = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
      } catch {
        skipped.push({ filename: file.name, reason: 'xlsx 파싱 실패' })
        continue
      }

      // ── 훈련 주간 달력 데이터 (모든 폴더 처리) ──────────────────────────────
      const { data: tcData, weeks: tcWeeks, alerts: tcAlerts } = processForTrainingCalendar(jsonData)
      if (Object.keys(tcData).length > 0) {
        const catId = `cat-${tcCatName}`
        if (!tcCategoryMap[catId]) {
          tcCategoryMap[catId] = { id: catId, name: tcCatName, courses: [] }
        }
        const courseId = `course-${file.name.replace(/\.(xlsx|xls)$/i, '').replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}`
        const entry: TCCourseEntry = { id: courseId, fileName: file.name, data: tcData, weeks: tcWeeks, alerts: tcAlerts }
        const existingIdx = tcCategoryMap[catId].courses.findIndex(c => c.fileName === file.name)
        if (existingIdx >= 0) {
          tcCategoryMap[catId].courses[existingIdx] = entry
        } else {
          tcCategoryMap[catId].courses.push(entry)
        }
      }

      // ── course_daily_schedules: 근로자(EMPLOYED)만 처리 ─────────────────────
      if (folderType !== 'EMPLOYED') {
        calendarOnly.push({ filename: file.name, category: tcCatName })
        continue
      }

      if (schedules.size === 0 || !roomNumber) {
        unmatched.push({ filename: file.name, reason: '시간표 데이터 없음' })
        continue
      }

      // 과정 매칭: 개강일 + 강의장
      const startDateFromName = getStartDateFromFilename(file.name)
      const roomBase = roomNumber.replace('호', '')
      let courseId: number | null = null
      let courseName = ''

      // 1차: 파일명 개강일 + 강의장
      if (startDateFromName) {
        const { data: courses } = await supabase
          .from('courses')
          .select('id, course_name')
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
            .select('id, course_name')
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

    // course_daily_schedules 일괄 upsert
    if (allRecords.length > 0) {
      const { error } = await supabase
        .from('course_daily_schedules')
        .upsert(allRecords, { onConflict: 'course_id,training_date' })
      if (error) throw error
    }

    // 훈련 주간 달력 상태 저장 (카테고리 순서: 근로자 → 실업자 → 일반 → 과정평가형)
    const tcCategories = Object.values(tcCategoryMap).sort((a, b) => {
      const order = ['cat-근로자', 'cat-실업자', 'cat-일반', 'cat-과정평가형']
      return (order.indexOf(a.id) ?? 99) - (order.indexOf(b.id) ?? 99)
    })

    if (tcCategories.length > 0) {
      await supabase.from('training_calendar_state').upsert({
        id: 1,
        categories: tcCategories,
        active_category: tcCategories[0]?.id ?? null,
        active_course_id: tcCategories[0]?.courses[0]?.id ?? null,
        expanded_months: [],
        updated_at: new Date().toISOString(),
        updated_by: user.email ?? user.id,
      }, { onConflict: 'id' })
    }

    return NextResponse.json({
      success: true,
      total: files.length,
      matched,
      unmatched,
      skipped,
      calendarOnly,
      recordsSaved: allRecords.length,
      calendarCourses: tcCategories.reduce((acc, c) => acc + c.courses.length, 0),
    })
  } catch (e) {
    console.error('folder-upload POST error:', e)
    return NextResponse.json({ error: '업로드 처리 중 오류 발생' }, { status: 500 })
  }
}
