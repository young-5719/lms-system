import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const IMPORT_API_KEY = process.env.IMPORT_API_KEY || 'lms-import-2026'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// "HH:mm" 형태만 추출, 불가능하면 null
function parseTime(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim()
  const match = s.match(/(\d{1,2}:\d{2})/)
  return match ? match[1] : null
}

// varchar(N) 길이 초과 방지
function truncate(val: unknown, maxLen: number): string | null {
  if (!val) return null
  const s = String(val).trim()
  return s === '' || s === '-' ? null : s.substring(0, maxLen)
}

// 숫자 파싱 (-, 빈값, 문자열 → null)
function toNum(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const s = String(val).replace(/[,%\s]/g, '').trim()
  if (s === '' || s === '-' || s === 'null') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// 정수 파싱
function toInt(val: unknown): number | null {
  const n = toNum(val)
  return n !== null ? Math.round(n) : null
}

// "09:00~14:00" → 5 (시간), 숫자면 그대로 반환
function parseHoursFromRange(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (s === '' || s === '-') return null
  // 시간 범위 형태
  const match = s.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/)
  if (match) {
    const start = parseInt(match[1]) * 60 + parseInt(match[2])
    const end = parseInt(match[3]) * 60 + parseInt(match[4])
    return Math.max(0, (end - start) / 60)
  }
  // 숫자 형태
  return toNum(val)
}

// POST - 구글 시트에서 과정 일괄 등록
export async function POST(request: NextRequest) {
  try {
    // API 키 검증
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== IMPORT_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const courses = Array.isArray(body) ? body : [body]

    const results = { success: 0, failed: 0, errors: [] as string[] }

    for (const course of courses) {
      const courseData = {
        training_id: course.trainingId,
        course_name: course.courseName,
        course_code_id: course.courseCodeId || '-',
        ncs_code: truncate(course.ncsCode, 255),
        round: toInt(course.round),
        category: truncate(course.category, 100),
        type: course.type || 'GENERAL',
        sub_category: truncate(course.subCategory, 100),
        detail_category: truncate(course.detailCategory, 100),
        strategic_field: truncate(course.strategicField, 100),
        is_weekend: course.isWeekend || 'WEEKDAY',
        room_number: truncate(course.roomNumber, 20) || '-',
        start_date: course.startDate,
        end_date: course.endDate,
        day_of_week: truncate(course.dayOfWeek, 50),
        training_days: toInt(course.trainingDays),
        lecture_days: course.lectureDays || null,
        holidays: course.holidays || null,
        start_time: parseTime(course.startTime) || '09:00',
        end_time: parseTime(course.endTime) || '18:00',
        daily_hours: toNum(course.dailyHours),
        total_hours: toNum(course.totalHours),
        lunch_start: parseTime(course.lunchStart),
        lunch_end: parseTime(course.lunchEnd),
        instructor: truncate(course.instructor, 100),
        employment_manager: truncate(course.employmentManager, 100),
        capacity: toInt(course.capacity),
        tuition: toInt(course.tuition),
        special_lecture_1: truncate(course.specialLecture1, 200),
        special_lecture_1_time: parseHoursFromRange(course.specialLecture1Time),
        special_lecture_2: truncate(course.specialLecture2, 200),
        special_lecture_2_time: parseHoursFromRange(course.specialLecture2Time),
        operation_note: course.operationNote || null,
        presentation_date: course.presentationDate || null,
        presentation_time: parseHoursFromRange(course.presentationTime),
        current_students_gov: toInt(course.currentStudentsGov),
        current_students_gen: toInt(course.currentStudentsGen),
        recruitment_rate: toNum(course.recruitmentRate),
        dropouts: toInt(course.dropouts),
        completion_count: toInt(course.completionCount),
        completion_rate: toNum(course.completionRate),
        change_start_date: course.changeStartDate || null,
        changed_room: truncate(course.changedRoom, 20),
        schedule_change: course.scheduleChange || null,
      }

      const { error } = await supabase
        .from('courses')
        .upsert(courseData, { onConflict: 'training_id' })

      if (error) {
        results.failed++
        results.errors.push(`[${course.trainingId}] ${error.message}`)
      } else {
        results.success++
      }
    }

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Import failed', detail: String(error) },
      { status: 500 }
    )
  }
}
