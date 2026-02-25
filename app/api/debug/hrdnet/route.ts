import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'
const INST_CODE = '200701633'
const INST_NAME = '그린컴퓨터아트학원'
const AREA1 = '11'
const AREA2 = '11530'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 구로구 전체에서 그린컴퓨터아트학원 과정 찾기 (페이지 5까지만)
  const found: any[] = []
  const pagesSeen: number[] = []

  for (let page = 1; page <= 5; page++) {
    try {
      const url =
        `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do` +
        `?outType=1&sort=ASC&sortCol=2` +
        `&srchTraArea1=${AREA1}&srchTraArea2=${AREA2}` +
        `&srchTraStDt=20220101&srchTraEndDt=20251231` +
        `&authKey=${AUTH_KEY}&returnType=JSON&pageSize=100&pageNum=${page}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const json = await res.json()
      if (!json.returnJSON) break
      const parsed = JSON.parse(json.returnJSON)
      const items: any[] = Array.isArray(parsed.srchList) ? parsed.srchList : []
      if (items.length === 0) break

      pagesSeen.push(items.length)

      const ours = items.filter((item: any) =>
        item.instCd === INST_CODE ||
        String(item.subTitle || '').includes(INST_NAME)
      )
      found.push(...ours.map((item: any) => ({
        page,
        instCd: item.instCd,
        subTitle: item.subTitle,
        title: item.title,
        traStartDate: item.traStartDate,
        traEndDate: item.traEndDate,
        trainTarget: item.trainTarget,
      })))
    } catch (e: any) {
      return NextResponse.json({ error: e.message, found, pagesSeen })
    }
  }

  return NextResponse.json({
    totalFound: found.length,
    pagesSeen,
    instCodeMatch: found.filter(f => f.instCd === INST_CODE).length,
    subTitleMatch: found.filter(f => String(f.subTitle || '').includes(INST_NAME)).length,
    courses: found,
  })
}
