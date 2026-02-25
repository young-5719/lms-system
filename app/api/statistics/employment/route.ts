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
  if (trainTarget.includes('기업맞춤')) return 'CORPORATE'
  return null
}

const ALLOWED_TYPES = ['NATIONAL', 'ASSESSMENT', 'INDUSTRY', 'KDT', 'CORPORATE']

const TYPE_LABEL: Record<string, string> = {
  NATIONAL: '국가기간전략산업직종',
  ASSESSMENT: '과정평가형훈련',
  INDUSTRY: '산업구조변화대응',
  KDT: 'K-디지털 트레이닝',
  CORPORATE: '기업맞춤형훈련',
}

// HRD-Net 과정 목록 조회
// - srchTorgId 파라미터는 API에서 무시됨 (디버그로 확인)
// - srchTraArea1+Area2(구로구)로 범위 제한 후 instCd로 기관 필터
// - 클라이언트에서 traEndDate가 [from, to] 범위인 과정만 필터
async function fetchOurCourses(from: string, to: string): Promise<any[]> {
  const allItems: any[] = []
  let page = 1
  const fromHrd = toHrdDate(from)
  const toHrd = toHrdDate(to)

  // 최장 3년짜리 과정도 잡기 위해 srchTraStDt를 3년 전으로
  const broadFrom = new Date(from)
  broadFrom.setFullYear(broadFrom.getFullYear() - 3)
  const broadFromHrd = toHrdDate(broadFrom.toISOString().slice(0, 10))

  while (page <= 30) {
    try {
      const url =
        `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do` +
        `?outType=1&sort=ASC&sortCol=2` +
        `&srchTraArea1=${AREA1}&srchTraArea2=${AREA2}` +
        `&srchTraStDt=${broadFromHrd}&srchTraEndDt=${toHrd}` +
        `&authKey=${AUTH_KEY}&returnType=JSON&pageSize=100&pageNum=${page}`
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      const json = await res.json()
      if (!json.returnJSON) break
      const parsed = JSON.parse(json.returnJSON)
      const items: any[] = Array.isArray(parsed.srchList) ? parsed.srchList : []
      if (items.length === 0) break

      // instCd로 기관 필터 + 종강일이 [from, to] 범위인 과정만
      const ours = items.filter((item: any) => {
        const endDate = item.traEndDate || ''
        return (
          item.instCd === INST_CODE &&
          endDate >= fromHrd &&
          endDate <= toHrd
        )
      })
      allItems.push(...ours)
      if (items.length < 100) break
    } catch {
      break
    }
    page++
  }

  return allItems
}

// srchPart=1(훈련실적): finiCnt
// srchPart=2(취업현황): eiEmplRate3, eiEmplRate6
// 만족도(satisfyScore)는 APIPO0101T의 stdgScor 필드로 별도 제공됨
async function fetchCourseStats(trprId: string, trprDegr: string | number): Promise<{
  eiEmplRate3: string | null
  eiEmplRate6: string | null
  finiCnt: number | null
}> {
  const baseUrl =
    `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0103T.do` +
    `?srchTrprId=${trprId}&outType=2&srchTrprDegr=${trprDegr}` +
    `&authKey=${AUTH_KEY}&returnType=JSON`

  let eiEmplRate3: string | null = null
  let eiEmplRate6: string | null = null
  let finiCnt: number | null = null

  try {
    const [r1, r2] = await Promise.allSettled([
      fetch(baseUrl + '&srchPart=1', { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
      fetch(baseUrl + '&srchPart=2', { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
    ])

    // srchPart=1: 훈련실적 (수료인원)
    if (r1.status === 'fulfilled' && r1.value?.returnJSON) {
      const parsed = JSON.parse(r1.value.returnJSON)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const d = parsed[0]
        if (d.finiCnt != null && d.finiCnt !== '') finiCnt = Number(d.finiCnt)
      }
    }

    // srchPart=2: 취업현황 (취업률, fallback finiCnt)
    if (r2.status === 'fulfilled' && r2.value?.returnJSON) {
      const parsed = JSON.parse(r2.value.returnJSON)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const d = parsed[0]
        if (d.eiEmplRate3 != null && d.eiEmplRate3 !== '') eiEmplRate3 = String(d.eiEmplRate3)
        if (d.eiEmplRate6 != null && d.eiEmplRate6 !== '') eiEmplRate6 = String(d.eiEmplRate6)
        if (finiCnt == null && d.finiCnt != null && d.finiCnt !== '') finiCnt = Number(d.finiCnt)
      }
    }
  } catch {}

  return { eiEmplRate3, eiEmplRate6, finiCnt }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'

    // 1. HRD-Net 과정 목록 조회 (종강일 기준)
    const allCourses = await fetchOurCourses(from, to)

    // 2. 허용 훈련유형 필터 (종강일이 조회 기간에 해당하는 과정 전부 포함)
    const endedCourses = allCourses.filter(item => {
      const type = getType(item.trainTarget || '')
      return type !== null && ALLOWED_TYPES.includes(type)
    })

    // 3. 훈련실적 + 취업률 병렬 조회 (10개씩 배치)
    const results: Array<{
      courseName: string
      trprDegr: number
      type: string
      typeLabel: string
      startDate: string
      endDate: string
      capacity: number
      applicants: number
      eiEmplRate3: string | null
      eiEmplRate6: string | null
      finiCnt: number | null
      satisfyScore: number | null
    }> = []

    const BATCH = 10
    for (let i = 0; i < endedCourses.length; i += BATCH) {
      const batch = endedCourses.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(
        batch.map(item => fetchCourseStats(item.trprId, item.trprDegr || 1))
      )
      batchResults.forEach((res, j) => {
        const item = batch[j]
        const stats = res.status === 'fulfilled'
          ? res.value
          : { eiEmplRate3: null, eiEmplRate6: null, finiCnt: null }
        const type = getType(item.trainTarget || '') || 'NATIONAL'
        // 만족도: APIPO0101T의 stdgScor 필드 (훈련기관 평가점수, 100점 만점)
        const satisfyScore = item.stdgScor != null && item.stdgScor !== ''
          ? Number(item.stdgScor)
          : null
        results.push({
          courseName: item.title || '-',
          trprDegr: parseInt(item.trprDegr || '1', 10),
          type,
          typeLabel: TYPE_LABEL[type] || type,
          startDate: item.traStartDate || '-',
          endDate: item.traEndDate || '-',
          capacity: parseInt(item.yardMan || '0', 10),
          applicants: parseInt(item.regCourseMan || '0', 10),
          eiEmplRate3: stats.eiEmplRate3,
          eiEmplRate6: stats.eiEmplRate6,
          finiCnt: stats.finiCnt,
          satisfyScore,
        })
      })
    }

    // 4. 취업률 데이터 있는 과정 (집계용)
    const withData = results.filter(r => r.eiEmplRate6 != null || r.eiEmplRate3 != null)
    // 6개월 데이터 있는 과정만 (평균 계산 기준)
    const withRate6 = results.filter(r => r.eiEmplRate6 != null)

    // 5. 구분별 집계 (6개월 데이터 있는 과정 기준)
    const byType: Record<string, { rates3m: number[], rates6m: number[] }> = {}
    for (const r of withRate6) {
      if (!byType[r.type]) byType[r.type] = { rates3m: [], rates6m: [] }
      if (r.eiEmplRate3 != null) byType[r.type].rates3m.push(Number(r.eiEmplRate3))
      byType[r.type].rates6m.push(Number(r.eiEmplRate6))
    }

    const typeStats = Object.entries(byType).map(([type, s]) => ({
      type,
      typeLabel: TYPE_LABEL[type] || type,
      count: s.rates6m.length,
      avgRate3m: s.rates3m.length > 0 ? s.rates3m.reduce((a, b) => a + b, 0) / s.rates3m.length : null,
      avgRate6m: s.rates6m.length > 0 ? s.rates6m.reduce((a, b) => a + b, 0) / s.rates6m.length : null,
    }))

    const allRates3m = withRate6.filter(r => r.eiEmplRate3 != null).map(r => Number(r.eiEmplRate3))
    const allRates6m = withRate6.map(r => Number(r.eiEmplRate6!))

    // 수료율 집계
    const completionRates = results
      .filter(r => r.applicants > 0 && r.finiCnt != null)
      .map(r => (r.finiCnt! / r.applicants) * 100)
    const avgCompletionRate = completionRates.length > 0
      ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
      : null

    // 만족도 집계
    const satisfyScores = results.filter(r => r.satisfyScore != null).map(r => r.satisfyScore!)
    const avgSatisfyScore = satisfyScores.length > 0
      ? satisfyScores.reduce((a, b) => a + b, 0) / satisfyScores.length
      : null

    return NextResponse.json({
      totalQueried: endedCourses.length,
      totalWithData: withData.length,
      avgRate3m: allRates3m.length > 0 ? allRates3m.reduce((a, b) => a + b, 0) / allRates3m.length : null,
      avgRate6m: allRates6m.length > 0 ? allRates6m.reduce((a, b) => a + b, 0) / allRates6m.length : null,
      avgCompletionRate,
      avgSatisfyScore,
      typeStats,
      courses: results,
    })
  } catch (error) {
    console.error('Employment stats error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
