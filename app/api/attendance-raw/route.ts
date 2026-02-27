import { NextRequest, NextResponse } from 'next/server'

const AUTH_KEY = 'nu5MbqsELbZEf7UbhAxzdOTISoNSyWCe'
const HRD_URL = 'https://hrd.work24.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_4.jsp'

function getMonthList(startStr: string, endStr: string): string[] {
  const months: string[] = []
  const curr = new Date(
    parseInt(startStr.substring(0, 4)),
    parseInt(startStr.substring(4, 6)) - 1,
    1
  )
  const end = new Date(
    parseInt(endStr.substring(0, 4)),
    parseInt(endStr.substring(4, 6)) - 1,
    1
  )
  while (curr <= end) {
    const yyyy = curr.getFullYear()
    const mm = String(curr.getMonth() + 1).padStart(2, '0')
    months.push(yyyy + mm)
    curr.setMonth(curr.getMonth() + 1)
  }
  return months
}

async function fetchMonthlyData(courseCodeId: string, round: string, month: string): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      returnType: 'JSON',
      authKey: AUTH_KEY,
      srchTrprId: courseCodeId,
      srchTrprDegr: round,
      outType: '2',
      srchTorgId: 'student_detail',
      atendMo: month,
    })
    const res = await fetch(`${HRD_URL}?${params}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const text = await res.text()
    if (text.trim().startsWith('<')) return []
    const json = JSON.parse(text)
    if (json.returnJSON) {
      const realData = JSON.parse(json.returnJSON)
      if (realData.atabList) {
        return Array.isArray(realData.atabList) ? realData.atabList : [realData.atabList]
      }
    }
    return []
  } catch (e) {
    console.error('HRD attendance-raw fetch error:', e)
    return []
  }
}

function formatTime(t: string | null | undefined): string {
  if (!t || String(t).length < 4) return ''
  const s = String(t).trim()
  if (s.includes(':')) return s.substring(0, 5)
  return s.substring(0, 2) + ':' + s.substring(2, 4)
}

// atendSttusCd → 처리상태명 변환
const STATUS_CODE_MAP: Record<string, string> = {
  '01': '출석',
  '02': '결석',
  '03': '지각',
  '04': '조퇴',
  '05': '외출',
  '06': '공가',
  '07': '병가',
  '08': '기타',
  '09': '인정결석',
  '99': '중도탈락',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const courseCodeId = searchParams.get('courseCodeId')
  const round = searchParams.get('round')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!courseCodeId || !round || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'courseCodeId, round, startDate, endDate are required' },
      { status: 400 }
    )
  }

  const today = new Date()
  const todayStr =
    today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')
  const effectiveEnd = endDate < todayStr ? endDate : todayStr

  const targetMonths = getMonthList(startDate, effectiveEnd)

  let allLogs: any[] = []
  for (const m of targetMonths) {
    const logs = await fetchMonthlyData(courseCodeId, round, m)
    if (logs.length > 0) allLogs = allLogs.concat(logs)
  }

  const validLogs = allLogs.filter((item) => {
    const d = String(item.atendDe).trim()
    return d >= startDate && d <= effectiveEnd
  })

  const records = validLogs.map((item) => {
    const rawDate = String(item.atendDe || '').trim()
    const formattedDate =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate

    const statusCode = String(item.atendSttusCd || '').trim()
    const statusName = String(item.atendSttusNm || '').trim()

    // 공가/병가/인정결석(06/07/09) → 처리상태: '승인', 증빙자료: '인정'
    const isApproved = statusCode === '06' || statusCode === '07' || statusCode === '09'
    const 처리상태 = isApproved ? '승인' : statusName || STATUS_CODE_MAP[statusCode] || statusCode
    const 증빙자료 = isApproved ? '인정' : ''

    return {
      성명: String(item.cstmrNm || '').trim(),
      출결일자: formattedDate,
      입실시간: formatTime(item.lpsilTime),
      퇴실시간: formatTime(item.levromTime),
      처리상태,
      증빙자료,
    }
  })

  return NextResponse.json({ records, total: records.length })
}
