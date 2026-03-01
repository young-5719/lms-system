import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 공유 훈련 달력 데이터 조회 (전체 사용자 공유)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('training_calendar_state')
      .select('categories, active_category, active_course_id, expanded_months')
      .eq('id', 1)
      .single()

    if (!data) return NextResponse.json(null)

    return NextResponse.json({
      categories: data.categories ?? [],
      activeCategory: data.active_category ?? null,
      activeCourseId: data.active_course_id ?? null,
      expandedMonths: data.expanded_months ?? [],
    })
  } catch (error) {
    console.error('training-data GET error:', error)
    return NextResponse.json(null)
  }
}

// 공유 훈련 달력 데이터 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { categories, activeCategory, activeCourseId, expandedMonths } = body

    const { error } = await supabase
      .from('training_calendar_state')
      .upsert({
        id: 1,
        categories: categories ?? [],
        active_category: activeCategory ?? null,
        active_course_id: activeCourseId ?? null,
        expanded_months: expandedMonths ?? [],
        updated_at: new Date().toISOString(),
        updated_by: user.email ?? user.id,
      }, { onConflict: 'id' })

    if (error) {
      console.error('training-data POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('training-data POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
