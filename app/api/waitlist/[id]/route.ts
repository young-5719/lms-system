import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { name, phone, course_name, schedule, time_slot, note } = body

    if (!name?.trim() || !phone?.trim() || !course_name?.trim()) {
      return NextResponse.json({ error: '이름, 전화번호, 과정명은 필수입니다' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('waitlist')
      .update({
        name: name.trim(),
        phone: phone.trim(),
        course_name: course_name.trim(),
        schedule: schedule || null,
        time_slot: time_slot || null,
        note: note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Waitlist PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update waitlist entry' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { error } = await supabase
      .from('waitlist')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Waitlist DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete waitlist entry' }, { status: 500 })
  }
}
