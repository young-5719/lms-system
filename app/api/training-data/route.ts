import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 훈련 달력 + 출석부 연동 데이터 전체 초기화
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('course_daily_schedules').delete().gt('course_id', 0)
    await supabase.from('training_calendar_state').update({
      categories: [],
      active_category: null,
      active_course_id: null,
      expanded_months: [],
      updated_at: new Date().toISOString(),
      updated_by: user.email ?? user.id,
    }).eq('id', 1)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('training-data DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

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

    // 모든 카테고리를 순회하며 EMPLOYED 과정만 course_daily_schedules에 동기화
    // (카테고리 이름이 아닌 DB type='EMPLOYED' 기준으로 필터)
    try {
      const cats: any[] = categories ?? []

      // 기존 스케줄 전체 삭제 후 현재 상태로 재구성
      await supabase.from('course_daily_schedules').delete().gt('course_id', 0)

      for (const cat of cats) {
        for (const course of cat.courses ?? []) {
          const dates = Object.keys(course.data ?? {}).sort()
          if (dates.length === 0) continue

          // 첫 번째 날짜에서 강의실 추출
          const firstDateData = course.data[dates[0]]
          const roomRaw: string = firstDateData?.rooms?.[0] ?? ''
          const roomBase = roomRaw.replace(/호$/, '').trim()
          if (!roomBase) continue

          const firstDate = dates[0]

          // DB에서 EMPLOYED 과정만 매칭 (강의실 + 날짜 범위)
          const { data: matchedCourses } = await supabase
            .from('courses')
            .select('id')
            .or(`room_number.eq.${roomBase},room_number.eq.${roomBase}호`)
            .lte('start_date', firstDate)
            .gte('end_date', firstDate)
            .eq('type', 'EMPLOYED')
            .limit(1)

          if (!matchedCourses || matchedCourses.length === 0) continue

          const courseId = matchedCourses[0].id

          // 날짜별 스케줄 삽입
          const records = dates.map((date: string) => {
            const d = course.data[date]
            return {
              course_id: courseId,
              training_date: date,
              start_time: d?.minStart || null,
              end_time: d?.maxEnd || null,
              lunch_start: d?.lunchStart || null,
              lunch_end: d?.lunchEnd || null,
            }
          })

          if (records.length > 0) {
            await supabase.from('course_daily_schedules').insert(records)
          }
        }
      }
    } catch (syncErr) {
      console.error('course_daily_schedules sync error:', syncErr)
      // 달력 저장은 성공으로 처리
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('training-data POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
