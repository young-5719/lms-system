import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // 폴더 업로드된 과정 ID만 조회
    const { data: uploadedSchedules } = await supabase
      .from('course_daily_schedules')
      .select('course_id')

    const uploadedCourseIds = [...new Set((uploadedSchedules ?? []).map(s => s.course_id))]

    // 업로드된 과정이 없으면 빈 목록 반환
    if (uploadedCourseIds.length === 0) {
      return NextResponse.json({ ongoing: [], ended: [] })
    }

    // 업로드된 course_id에 해당하는 과정만 조회
    const { data: unique } = await supabase
      .from('courses')
      .select('id, course_name, course_code_id, round, start_date, end_date, start_time, end_time, total_hours, type, instructor, room_number, is_weekend')
      .in('id', uploadedCourseIds)
      .order('start_date', { ascending: false })

    const ongoing = (unique ?? []).filter(c => c.end_date >= todayStr && c.start_date <= todayStr)
    const ended = (unique ?? []).filter(c => c.end_date < todayStr)

    return NextResponse.json({ ongoing, ended })
  } catch (error) {
    console.error('Attendance list error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
