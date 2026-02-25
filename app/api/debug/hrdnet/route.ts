import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'
const INST_CODE = '200701633'
const AREA1 = '11'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to') || '20251231'

  const results: any = {}

  // 테스트 1: srchTorgId + srchTraArea1 + 날짜
  try {
    const url1 =
      `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do` +
      `?outType=1&sort=ASC&sortCol=2` +
      `&srchTraArea1=${AREA1}` +
      `&srchTraStDt=20200101&srchTraEndDt=${to}` +
      `&authKey=${AUTH_KEY}&returnType=JSON&pageSize=5&pageNum=1` +
      `&srchTorgId=${INST_CODE}`
    const r1 = await fetch(url1, { signal: AbortSignal.timeout(10000) })
    const j1 = await r1.json()
    if (j1.returnJSON) {
      const p1 = JSON.parse(j1.returnJSON)
      results.test1_with_area_and_torgId = {
        totalCount: p1.count || p1.srchList?.length || 0,
        sample: p1.srchList?.slice(0, 2) || [],
        fields: p1.srchList?.[0] ? Object.keys(p1.srchList[0]) : [],
      }
    } else {
      results.test1_with_area_and_torgId = { error: 'no returnJSON', raw: j1 }
    }
  } catch (e: any) {
    results.test1_with_area_and_torgId = { error: e.message }
  }

  // 테스트 2: srchTorgId만 (area 없음)
  try {
    const url2 =
      `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do` +
      `?outType=1&sort=ASC&sortCol=2` +
      `&srchTraStDt=20200101&srchTraEndDt=${to}` +
      `&authKey=${AUTH_KEY}&returnType=JSON&pageSize=5&pageNum=1` +
      `&srchTorgId=${INST_CODE}`
    const r2 = await fetch(url2, { signal: AbortSignal.timeout(10000) })
    const j2 = await r2.json()
    if (j2.returnJSON) {
      const p2 = JSON.parse(j2.returnJSON)
      results.test2_torgId_only = {
        totalCount: p2.count || p2.srchList?.length || 0,
        sample: p2.srchList?.slice(0, 2) || [],
        fields: p2.srchList?.[0] ? Object.keys(p2.srchList[0]) : [],
      }
    } else {
      results.test2_torgId_only = { error: 'no returnJSON', raw: j2 }
    }
  } catch (e: any) {
    results.test2_torgId_only = { error: e.message }
  }

  // 테스트 3: area1+area2 (srchTorgId 없음)
  try {
    const url3 =
      `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do` +
      `?outType=1&sort=ASC&sortCol=2` +
      `&srchTraArea1=${AREA1}&srchTraArea2=11530` +
      `&srchTraStDt=20200101&srchTraEndDt=${to}` +
      `&authKey=${AUTH_KEY}&returnType=JSON&pageSize=5&pageNum=1`
    const r3 = await fetch(url3, { signal: AbortSignal.timeout(10000) })
    const j3 = await r3.json()
    if (j3.returnJSON) {
      const p3 = JSON.parse(j3.returnJSON)
      results.test3_area_only_no_torgId = {
        totalCount: p3.count || p3.srchList?.length || 0,
        sample: p3.srchList?.slice(0, 2) || [],
        fields: p3.srchList?.[0] ? Object.keys(p3.srchList[0]) : [],
      }
    } else {
      results.test3_area_only_no_torgId = { error: 'no returnJSON', raw: j3 }
    }
  } catch (e: any) {
    results.test3_area_only_no_torgId = { error: e.message }
  }

  return NextResponse.json(results)
}
