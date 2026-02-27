import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - 사용자의 출석 계산기 데이터 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('attendance_calc_data')
      .select('courses, active_course_id, schedules, uploaded_files')
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json(null)

    return NextResponse.json({
      courses: data.courses,
      activeCourseId: data.active_course_id,
      schedules: data.schedules,
      uploadedFiles: data.uploaded_files,
    })
  } catch (error) {
    console.error('Error fetching attendance calc data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - 사용자의 출석 계산기 데이터 저장 (upsert)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { courses, activeCourseId, schedules, uploadedFiles } = body

    const { error } = await supabase
      .from('attendance_calc_data')
      .upsert({
        user_id: user.id,
        courses,
        active_course_id: activeCourseId,
        schedules,
        uploaded_files: uploadedFiles,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error saving attendance calc data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
