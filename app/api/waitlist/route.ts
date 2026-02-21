import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Waitlist GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, phone, course_name, schedule, time_slot, note } = body

    if (!name?.trim() || !phone?.trim() || !course_name?.trim()) {
      return NextResponse.json({ error: '이름, 전화번호, 과정명은 필수입니다' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('waitlist')
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        course_name: course_name.trim(),
        schedule: schedule || null,
        time_slot: time_slot || null,
        note: note?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Waitlist POST error:', error)
    return NextResponse.json({ error: 'Failed to create waitlist entry' }, { status: 500 })
  }
}
