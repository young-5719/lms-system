import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'

async function fetchEmploymentRate(courseCodeId: string, round: number): Promise<{
  eiEmplRate3: string | null
  eiEmplRate6: string | null
  finiCnt: number | null
  totTrpCnt: number | null
}> {
  try {
    const url = `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0103T.do?srchTrprId=${courseCodeId}&outType=2&srchTrprDegr=${round}&authKey=${AUTH_KEY}&returnType=JSON&srchPart=2`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const json = await res.json()
    if (json.returnJSON) {
      const parsed = JSON.parse(json.returnJSON)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const d = parsed[0]
        return {
          eiEmplRate3: d.eiEmplRate3 != null && d.eiEmplRate3 !== '' ? String(d.eiEmplRate3) : null,
          eiEmplRate6: d.eiEmplRate6 != null && d.eiEmplRate6 !== '' ? String(d.eiEmplRate6) : null,
          finiCnt: d.finiCnt != null ? Number(d.finiCnt) : null,
          totTrpCnt: d.totTrpCnt != null ? Number(d.totTrpCnt) : null,
        }
      }
    }
  } catch {}
  return { eiEmplRate3: null, eiEmplRate6: null, finiCnt: null, totTrpCnt: null }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const today = format(new Date(), 'yyyy-MM-dd')
    const from = searchParams.get('from') || '2026-01-01'
    const to = searchParams.get('to') || today

    // 개강일 범위 내 과정 조회 (course_code_id 있는 것만)
    const { data: courses } = await supabase
      .from('courses')
      .select('course_name, type, course_code_id, round, end_date, capacity, current_students_gov, current_students_gen')
      .gte('start_date', from)
      .lte('start_date', to)
      .not('course_code_id', 'is', null)

    // 종료된 과정만 취업률 조회 가능
    const endedCourses = (courses ?? []).filter(c =>
      c.course_code_id && c.course_code_id !== '-' && c.end_date && c.end_date <= today
    )

    // 10개씩 병렬 조회
    const results: Array<{
      courseName: string
      type: string
      capacity: number
      students: number
      eiEmplRate3: string | null
      eiEmplRate6: string | null
      finiCnt: number | null
      totTrpCnt: number | null
    }> = []

    const BATCH = 10
    for (let i = 0; i < endedCourses.length; i += BATCH) {
      const batch = endedCourses.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(
        batch.map(c => fetchEmploymentRate(c.course_code_id!, c.round || 1))
      )
      batchResults.forEach((res, j) => {
        const c = batch[j]
        const emp = res.status === 'fulfilled' ? res.value : { eiEmplRate3: null, eiEmplRate6: null, finiCnt: null, totTrpCnt: null }
        results.push({
          courseName: c.course_name,
          type: c.type || 'GENERAL',
          capacity: c.capacity || 0,
          students: (c.current_students_gov || 0) + (c.current_students_gen || 0),
          eiEmplRate3: emp.eiEmplRate3,
          eiEmplRate6: emp.eiEmplRate6,
          finiCnt: emp.finiCnt,
          totTrpCnt: emp.totTrpCnt,
        })
      })
    }

    // 취업률 데이터 있는 과정만
    const withData = results.filter(r => r.eiEmplRate6 != null || r.eiEmplRate3 != null)

    // 구분별 집계
    const TYPE_LABEL: Record<string, string> = {
      GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
      NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
    }
    const byType: Record<string, { rates3m: number[], rates6m: number[] }> = {}
    for (const r of withData) {
      if (!byType[r.type]) byType[r.type] = { rates3m: [], rates6m: [] }
      if (r.eiEmplRate3 != null) byType[r.type].rates3m.push(Number(r.eiEmplRate3))
      if (r.eiEmplRate6 != null) byType[r.type].rates6m.push(Number(r.eiEmplRate6))
    }

    const typeStats = Object.entries(byType).map(([type, s]) => ({
      type,
      typeLabel: TYPE_LABEL[type] || type,
      count: Math.max(s.rates3m.length, s.rates6m.length),
      avgRate3m: s.rates3m.length > 0 ? s.rates3m.reduce((a, b) => a + b, 0) / s.rates3m.length : null,
      avgRate6m: s.rates6m.length > 0 ? s.rates6m.reduce((a, b) => a + b, 0) / s.rates6m.length : null,
    }))

    const allRates3m = withData.filter(r => r.eiEmplRate3 != null).map(r => Number(r.eiEmplRate3))
    const allRates6m = withData.filter(r => r.eiEmplRate6 != null).map(r => Number(r.eiEmplRate6))

    return NextResponse.json({
      totalQueried: endedCourses.length,
      totalWithData: withData.length,
      avgRate3m: allRates3m.length > 0 ? allRates3m.reduce((a, b) => a + b, 0) / allRates3m.length : null,
      avgRate6m: allRates6m.length > 0 ? allRates6m.reduce((a, b) => a + b, 0) / allRates6m.length : null,
      typeStats,
      courses: withData,
    })
  } catch (error) {
    console.error('Employment stats error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
