import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - 사용자의 훈련 달력 데이터 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('training_calendar_data')
      .select('categories, active_category, active_course_id, expanded_months')
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json(null)

    return NextResponse.json({
      categories: data.categories,
      activeCategory: data.active_category,
      activeCourseId: data.active_course_id,
      expandedMonths: data.expanded_months,
    })
  } catch (error) {
    console.error('Error fetching training data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - 사용자의 훈련 달력 데이터 저장 (upsert)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { categories, activeCategory, activeCourseId, expandedMonths } = body

    const { error } = await supabase
      .from('training_calendar_data')
      .upsert({
        user_id: user.id,
        categories,
        active_category: activeCategory,
        active_course_id: activeCourseId,
        expanded_months: expandedMonths,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error saving training data:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
