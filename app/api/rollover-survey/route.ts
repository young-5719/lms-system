import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'
const HRD_URL = 'https://hrd.work24.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_4.jsp'

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
    months.push(curr.getFullYear() + String(curr.getMonth() + 1).padStart(2, '0'))
    curr.setMonth(curr.getMonth() + 1)
  }
  return months
}

async function fetchStudentNames(
  courseCodeId: string,
  round: string,
  months: string[]
): Promise<{ id: string; name: string }[]> {
  const studentMap = new Map<string, string>()

  for (const month of months) {
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
      if (text.trim().startsWith('<')) continue

      const json = JSON.parse(text)
      if (json.returnJSON) {
        const realData = JSON.parse(json.returnJSON)
        const logs = Array.isArray(realData.atabList)
          ? realData.atabList
          : realData.atabList
          ? [realData.atabList]
          : []
        for (const log of logs) {
          if (log.trneeCstmrId && log.cstmrNm && !studentMap.has(log.trneeCstmrId)) {
            studentMap.set(log.trneeCstmrId, log.cstmrNm)
          }
        }
      }
    } catch {
      // 월별 fetch 실패 시 건너뜀
    }
  }

  return Array.from(studentMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get('trainingId')
    if (!trainingId) return NextResponse.json({ error: 'trainingId required' }, { status: 400 })

    const { data: course } = await supabase
      .from('courses')
      .select('training_id, course_name, instructor, start_date, end_date, course_code_id, round')
      .eq('training_id', Number(trainingId))
      .single()

    if (!course) {
      return NextResponse.json({ error: '과정을 찾을 수 없습니다' }, { status: 404 })
    }

    const startStr = course.start_date.replace(/-/g, '')
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const endStr = course.end_date.replace(/-/g, '')
    const effectiveEnd = endStr < todayStr ? endStr : todayStr

    const months = getMonthList(startStr, effectiveEnd)
    const students = await fetchStudentNames(
      course.course_code_id,
      String(course.round || 1),
      months
    )

    return NextResponse.json({
      course: {
        trainingId: course.training_id,
        courseName: course.course_name,
        instructor: course.instructor || '-',
        startDate: course.start_date,
        endDate: course.end_date,
      },
      students,
    })
  } catch (error) {
    console.error('Rollover survey error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
