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

    // 근로자(EMPLOYED) 과정 - 평일 저녁, 주말 무관하게 전체 포함
    const { data: unique } = await supabase
      .from('courses')
      .select('id, course_name, course_code_id, round, start_date, end_date, start_time, end_time, total_hours, type, instructor, room_number, is_weekend')
      .eq('type', 'EMPLOYED')
      .order('start_date', { ascending: false })

    const ongoing = (unique ?? []).filter(c => c.end_date >= todayStr && c.start_date <= todayStr)
    const ended = (unique ?? []).filter(c => c.end_date < todayStr)

    return NextResponse.json({ ongoing, ended })
  } catch (error) {
    console.error('Attendance list error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
