import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'
const INST_CODE = '200701633'
const INST_NAME = '그린컴퓨터아트학원'
const AREA1 = '11'       // 서울
const AREA2 = '11530'    // 구로구

function toHrdDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function getType(trainTarget: string): string | null {
  if (trainTarget.includes('국가기간')) return 'NATIONAL'
  if (trainTarget.includes('과정평가')) return 'ASSESSMENT'
  if (trainTarget.includes('산업구조변화대응') || trainTarget.includes('산대특')) return 'INDUSTRY'
  if (trainTarget.includes('KDT') || trainTarget.includes('K-디지털') || trainTarget.includes('디지털트레이닝')) return 'KDT'
  return null
}

const ALLOWED_TYPES = ['NATIONAL', 'ASSESSMENT', 'INDUSTRY', 'KDT']

const TYPE_LABEL: Record<string, string> = {
  NATIONAL: '국가기간전략산업직종',
  ASSESSMENT: '과정평가형훈련',
  INDUSTRY: '산업구조변화대응',
  KDT: 'K-디지털 트레이닝',
}

async function fetchOurCourses(from: string, to: string): Promise<any[]> {
  const allItems: any[] = []
  let page = 1

  while (page <= 30) {
    try {
      const url =
        `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do` +
        `?outType=1&sort=ASC` +
        `&srchTraArea1=${AREA1}&srchTraArea2=${AREA2}` +
        `&srchTraStDt=${toHrdDate(from)}&srchTraEndDt=${toHrdDate(to)}` +
        `&sortCol=2&authKey=${AUTH_KEY}&returnType=JSON&pageSize=100&pageNum=${page}` +
        `&srchTorgId=${INST_CODE}`
      const res = await fetch(url)
      const json = await res.json()
      if (!json.returnJSON) break
      const parsed = JSON.parse(json.returnJSON)
      const items: any[] = Array.isArray(parsed.srchList) ? parsed.srchList : []
      if (items.length === 0) break
      // 기관명으로 한 번 더 필터 (srchTorgId가 작동 안 할 경우 대비)
      const ours = items.filter((item: any) => String(item.subTitle || '').includes(INST_NAME))
      allItems.push(...ours)
      if (items.length < 100) break
    } catch {
      break
    }
    page++
  }

  return allItems
}

async function fetchEmploymentRate(trprId: string, trprDegr: string | number): Promise<{
  eiEmplRate3: string | null
  eiEmplRate6: string | null
  finiCnt: number | null
}> {
  try {
    const url =
      `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0103T.do` +
      `?srchTrprId=${trprId}&outType=2&srchTrprDegr=${trprDegr}` +
      `&authKey=${AUTH_KEY}&returnType=JSON&srchPart=2`
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
        }
      }
    }
  } catch {}
  return { eiEmplRate3: null, eiEmplRate6: null, finiCnt: null }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const today = new Date().toISOString().slice(0, 10)
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'

    // 1. HRD-Net에서 우리 기관 과정 전체 조회
    const allCourses = await fetchOurCourses(from, to)

    // 2. 종료된 과정 + 허용 훈련유형 필터
    const endedCourses = allCourses.filter(item => {
      const endDate = item.traEndDate || ''
      if (!endDate || endDate >= today) return false
      const type = getType(item.trainTarget || '')
      return type !== null && ALLOWED_TYPES.includes(type)
    })

    // 3. 취업률 병렬 조회 (10개씩 배치)
    const results: Array<{
      courseName: string
      type: string
      typeLabel: string
      capacity: number
      applicants: number
      eiEmplRate3: string | null
      eiEmplRate6: string | null
      finiCnt: number | null
    }> = []

    const BATCH = 10
    for (let i = 0; i < endedCourses.length; i += BATCH) {
      const batch = endedCourses.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(
        batch.map(item => fetchEmploymentRate(item.trprId, item.trprDegr || 1))
      )
      batchResults.forEach((res, j) => {
        const item = batch[j]
        const emp = res.status === 'fulfilled'
          ? res.value
          : { eiEmplRate3: null, eiEmplRate6: null, finiCnt: null }
        const type = getType(item.trainTarget || '') || 'NATIONAL'
        results.push({
          courseName: item.title || '-',
          type,
          typeLabel: TYPE_LABEL[type] || type,
          capacity: parseInt(item.yardMan || '0', 10),
          applicants: parseInt(item.regCourseMan || '0', 10),
          eiEmplRate3: emp.eiEmplRate3,
          eiEmplRate6: emp.eiEmplRate6,
          finiCnt: emp.finiCnt,
        })
      })
    }

    // 4. 취업률 데이터 있는 과정만
    const withData = results.filter(r => r.eiEmplRate6 != null || r.eiEmplRate3 != null)

    // 5. 구분별 집계
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
