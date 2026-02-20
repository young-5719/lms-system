import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

// 통계 페이지(statistics/page.tsx)와 완전히 동일한 계산 로직
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const today = format(new Date(), 'yyyy-MM-dd')
    const from = searchParams.get('from') || '2026-01-01'
    const to = searchParams.get('to') || today

    const { data: courses } = await supabase
      .from('courses')
      .select('capacity, current_students_gov, current_students_gen, completion_count')
      .gte('start_date', from)
      .lte('start_date', to)

    const allCourses = courses ?? []

    // 모집률 = 총수강생 ÷ 총정원
    const totalCapacity = allCourses.reduce((s, c) => s + (c.capacity || 0), 0)
    const totalStudents = allCourses.reduce((s, c) => s + (c.current_students_gov || 0) + (c.current_students_gen || 0), 0)
    const overallRate = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : null

    // 평균 수료율 = 과정별 (수료인원 ÷ 수강생) 평균
    const completionCourses = allCourses.filter(c => {
      const students = (c.current_students_gov || 0) + (c.current_students_gen || 0)
      return students > 0 && (c.completion_count || 0) > 0
    })
    const avgCompletionRate = completionCourses.length > 0
      ? completionCourses.reduce((sum, c) => {
          const students = (c.current_students_gov || 0) + (c.current_students_gen || 0)
          return sum + ((c.completion_count || 0) / students) * 100
        }, 0) / completionCourses.length
      : null

    return NextResponse.json({
      from,
      to,
      totalCourses: allCourses.length,
      totalCapacity,
      totalStudents,
      overallRate,
      avgCompletionRate,
    })
  } catch (error) {
    console.error('Statistics API error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
