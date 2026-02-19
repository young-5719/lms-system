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

    // 저녁반 (19:00 시작, 일반 제외)
    const { data: eveningCourses } = await supabase
      .from('courses')
      .select('id, course_name, course_code_id, round, start_date, end_date, start_time, end_time, total_hours, type, instructor, room_number, is_weekend')
      .eq('start_time', '19:00')
      .neq('type', 'GENERAL')
      .order('start_date', { ascending: false })

    // 주말반
    const { data: weekendCourses } = await supabase
      .from('courses')
      .select('id, course_name, course_code_id, round, start_date, end_date, start_time, end_time, total_hours, type, instructor, room_number, is_weekend')
      .eq('is_weekend', 'WEEKEND')
      .order('start_date', { ascending: false })

    const allCourses = [...(eveningCourses || []), ...(weekendCourses || [])]
    // 중복 제거 (주말 19:00 시작인 경우)
    const seen = new Set<number>()
    const unique = allCourses.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    const ongoing = unique.filter(c => c.end_date >= todayStr && c.start_date <= todayStr)
    const ended = unique.filter(c => c.end_date < todayStr)

    return NextResponse.json({ ongoing, ended })
  } catch (error) {
    console.error('Attendance list error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
