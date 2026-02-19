import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'

const SEOUL_DISTRICT_CODES: Record<string, string> = {
  '서울 전체': '',
  '강남구': '11680',
  '강동구': '11740',
  '강북구': '11305',
  '강서구': '11500',
  '관악구': '11620',
  '광진구': '11215',
  '구로구': '11530',
  '금천구': '11545',
  '노원구': '11350',
  '도봉구': '11320',
  '동대문구': '11230',
  '동작구': '11590',
  '마포구': '11440',
  '서대문구': '11410',
  '서초구': '11650',
  '성동구': '11200',
  '성북구': '11290',
  '송파구': '11710',
  '양천구': '11470',
  '영등포구': '11560',
  '용산구': '11170',
  '은평구': '11380',
  '종로구': '11110',
  '중구': '11140',
  '중랑구': '11260',
}

const TARGET_ACADEMIES = ['엠비씨', 'MBC', '한국IT', '한국아이티', '그린컴퓨터']

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

async function fetchPage(baseUrl: string, page: number): Promise<any[]> {
  try {
    const url = `${baseUrl}&pageNum=${page}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.returnJSON) {
      const parsed = JSON.parse(json.returnJSON)
      return Array.isArray(parsed.srchList) ? parsed.srchList : []
    }
  } catch (e) {
    console.error('HRD API fetch error:', e)
  }
  return []
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const district = searchParams.get('district') || '구로구'
    const minOne = searchParams.get('minOne') === 'true'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const districtCode = SEOUL_DISTRICT_CODES[district]
    if (districtCode === undefined) {
      return NextResponse.json({ error: 'Invalid district' }, { status: 400 })
    }

    const startDate = startDateParam ? new Date(startDateParam) : new Date(2026, 0, 1)
    const endDate = endDateParam ? new Date(endDateParam) : (() => { const d = new Date(); d.setMonth(d.getMonth() + 2); return d })()

    const startParam = formatDate(startDate)
    const endParam = formatDate(endDate)

    let baseUrl = `https://hrd.work24.go.kr/hrdp/api/apipo/APIPO0101T.do?outType=1&sort=ASC&srchTraArea1=11&srchTraStDt=${startParam}&pageSize=100&srchTraEndDt=${endParam}&sortCol=2&authKey=${AUTH_KEY}&returnType=JSON&pageSize=100`

    if (districtCode) {
      baseUrl += `&srchTraArea2=${districtCode}`
    }

    const allItems: any[] = []
    let page = 1

    while (page <= 50) {
      const items = await fetchPage(baseUrl, page)
      if (!items || items.length === 0) break

      for (const item of items) {
        const academyName = String(item.subTitle || '').trim()
        const address = String(item.address || '').trim()

        // 학원 필터
        if (!TARGET_ACADEMIES.some(k => academyName.includes(k))) continue

        // 지역 필터 (서울 전체가 아닌 경우)
        if (district !== '서울 전체' && !address.includes(district.replace('구', ''))) {
          // 주소에 구 이름이 없어도 districtCode로 이미 필터됨
        }

        const regNum = parseInt(item.regCourseMan || '0', 10)
        if (minOne && regNum === 0) continue

        // 학원명 변환
        let displayName = academyName
        if (academyName.includes('엠비씨') || academyName.includes('MBC')) {
          displayName = 'MBC아카데미'
        } else if (academyName.includes('한국IT') || academyName.includes('한국아이티')) {
          displayName = '한국아이티'
        } else if (academyName.includes('그린컴퓨터')) {
          displayName = '그린컴퓨터아트학원'
        }

        // D-day 계산
        const startDateStr = item.traStartDate || ''
        let dDay = '-'
        let dDayNum = 999
        if (startDateStr) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const target = new Date(startDateStr)
          target.setHours(0, 0, 0, 0)
          const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          dDayNum = diff
          if (diff === 0) dDay = '오늘개강'
          else if (diff < 0) dDay = '개강함'
          else dDay = `D-${diff}`
        }

        allItems.push({
          dDay,
          dDayNum,
          trainType: (item.trainTarget || '').trim(),
          academy: displayName,
          rawAcademy: academyName,
          courseName: item.title || '-',
          round: item.trprDegr || '-',
          startDate: startDateStr,
          endDate: item.traEndDate || '-',
          cost: Number(item.courseMan || 0),
          selfPay: Number(item.realMan || 0),
          capacity: item.yardMan || '0',
          address,
          phone: item.telNo || '-',
          ncsCode: item.ncsCd || '-',
          link: item.titleLink || '',
          applicants: regNum,
        })
      }

      page++
    }

    // D-day 순 정렬
    allItems.sort((a, b) => a.dDayNum - b.dDayNum)

    return NextResponse.json({
      district,
      totalCount: allItems.length,
      fetchedAt: new Date().toISOString(),
      items: allItems,
    })
  } catch (error) {
    console.error('Competitors API error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
