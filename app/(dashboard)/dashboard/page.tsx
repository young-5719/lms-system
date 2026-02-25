import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import Link from 'next/link'

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
  NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
}

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const dayOfWeek = now.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  // 날짜 계산
  const in5Date = new Date(now); in5Date.setDate(in5Date.getDate() + 5)
  const in3Date = new Date(now); in3Date.setDate(in3Date.getDate() + 3)
  const tomorrowDate = new Date(now); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const in5days = format(in5Date, 'yyyy-MM-dd')
  const in3days = format(in3Date, 'yyyy-MM-dd')
  const tomorrow = format(tomorrowDate, 'yyyy-MM-dd')

  // 전월 / 전전월 날짜
  const prevMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthLast = new Date(now.getFullYear(), now.getMonth(), 0)
  const prevMonthStart = format(prevMonthFirst, 'yyyy-MM-dd')
  const prevMonthEnd = format(prevMonthLast, 'yyyy-MM-dd')
  const prevMonthLabel = format(prevMonthFirst, 'M월')

  const prevPrevMonthFirst = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const prevPrevMonthLast = new Date(now.getFullYear(), now.getMonth() - 1, 0)
  const prevPrevMonthStart = format(prevPrevMonthFirst, 'yyyy-MM-dd')
  const prevPrevMonthEnd = format(prevPrevMonthLast, 'yyyy-MM-dd')
  const prevPrevMonthLabel = format(prevPrevMonthFirst, 'M월')

  // 기본 집계용 과정 데이터
  const { data: courses } = await supabase
    .from('courses')
    .select('training_id, course_name, type, start_date, end_date, instructor, room_number')

  const allCourses = courses ?? []
  const totalCourses = allCourses.length

  const ongoingCourses = allCourses.filter(c => c.start_date <= today && c.end_date >= today)
  const ongoingCount = ongoingCourses.length
  const ongoingByType: Record<string, number> = {}
  for (const c of ongoingCourses) {
    const t = c.type || 'GENERAL'
    ongoingByType[t] = (ongoingByType[t] || 0) + 1
  }

  const instructorSet = new Set(
    allCourses
      .filter(c => c.start_date >= '2026-01-01' && c.start_date <= '2026-12-31')
      .map(c => (c.instructor || '').trim())
      .filter(i => i && i !== '-')
  )
  const instructorCount = instructorSet.size

  // 오늘 개강
  const todayOpening = allCourses.filter(c => c.start_date === today)

  // 5일 이내 개강 예정 (오늘 제외)
  const openingSoon = allCourses
    .filter(c => c.start_date >= tomorrow && c.start_date <= in5days)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  // 3일 이내 종강 (오늘 포함)
  const closingSoon = allCourses
    .filter(c => c.end_date >= today && c.end_date <= in3days)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))

  const dDayLabel = (dateStr: string) => {
    const diff = Math.round((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000)
    if (diff === 0) return '오늘'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  // ── 내부 API 호출용 Base URL + 쿠키 ─────────────────────────
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const baseUrl = `${proto}://${host}`

  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')
  const fetchOpts = { headers: { cookie: cookieHeader }, cache: 'no-store' } as const

  // ── 전월 / 전전월 통계 병렬 호출 ─────────────────────────────
  let prevMonthRate: number | null = null
  let prevMonthCompletion: number | null = null
  let prevPrevMonthRate: number | null = null
  let prevPrevMonthCompletion: number | null = null
  try {
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/statistics?from=${prevMonthStart}&to=${prevMonthEnd}`, fetchOpts),
      fetch(`${baseUrl}/api/statistics?from=${prevPrevMonthStart}&to=${prevPrevMonthEnd}`, fetchOpts),
    ])
    if (r1.ok) { const d = await r1.json(); prevMonthRate = d.overallRate; prevMonthCompletion = d.avgCompletionRate }
    if (r2.ok) { const d = await r2.json(); prevPrevMonthRate = d.overallRate; prevPrevMonthCompletion = d.avgCompletionRate }
  } catch { /* 조용히 실패 */ }

  // 전전월 대비 증감
  const rateDiff = prevMonthRate != null && prevPrevMonthRate != null ? prevMonthRate - prevPrevMonthRate : null
  const completionDiff = prevMonthCompletion != null && prevPrevMonthCompletion != null ? prevMonthCompletion - prevPrevMonthCompletion : null
  const fmtDiff = (d: number | null) => d == null ? null : (d >= 0 ? `+${d.toFixed(1)}%p` : `${d.toFixed(1)}%p`)
  const diffColor = (d: number | null) => d == null ? '' : d >= 0 ? 'text-green-600' : 'text-red-500'

  // ── 빈강의장 API 호출 (empty-rooms 페이지와 동일한 계산) ────
  type SlotInfo = { occupied: boolean; courseName?: string; instructor?: string; type?: string }
  let roomMatrix: Record<string, Record<string, SlotInfo>> = {}
  try {
    const res = await fetch(`${baseUrl}/api/empty-rooms?date=${today}`, fetchOpts)
    if (res.ok) {
      const d = await res.json()
      roomMatrix = d.matrix || {}
    }
  } catch { /* 조용히 실패 */ }

  // ── 이번 달 예상매출 API 호출 ─────────────────────────────
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  interface RevenuePeriod {
    id: string; label: string; start: string; end: string
    paymentDate: string; month: number; half: number
    courses: unknown[]
    totalByType: { NATIONAL: number; UNEMPLOYED: number; EMPLOYED: number }
    total: number
  }
  let monthPeriods: RevenuePeriod[] = []
  let monthTotal = 0
  let monthByType = { NATIONAL: 0, UNEMPLOYED: 0, EMPLOYED: 0 }
  try {
    const res = await fetch(`${baseUrl}/api/revenue?year=${currentYear}`, fetchOpts)
    if (res.ok) {
      const d = await res.json()
      monthPeriods = (d.periods as RevenuePeriod[]).filter((p: RevenuePeriod) => p.month === currentMonth)
      monthTotal = monthPeriods.reduce((s, p) => s + p.total, 0)
      monthByType = {
        NATIONAL: monthPeriods.reduce((s, p) => s + p.totalByType.NATIONAL, 0),
        UNEMPLOYED: monthPeriods.reduce((s, p) => s + p.totalByType.UNEMPLOYED, 0),
        EMPLOYED: monthPeriods.reduce((s, p) => s + p.totalByType.EMPLOYED, 0),
      }
    }
  } catch { /* 조용히 실패 */ }

  const fmtWon = (n: number) => {
    if (n === 0) return '-'
    if (n >= 100_000_000) {
      const eok = Math.floor(n / 100_000_000)
      const man = Math.floor((n % 100_000_000) / 10_000)
      return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
    }
    return `${Math.floor(n / 10_000).toLocaleString()}만원`
  }

  // 19:00 슬롯 기준 강의실 현황
  const eveningOccupied = new Map<string, SlotInfo>()
  for (const room of ALL_ROOMS) {
    const slot = roomMatrix[room]?.['19:00']
    if (slot?.occupied) eveningOccupied.set(room, slot)
  }
  const emptyRooms = ALL_ROOMS.filter(r => !eveningOccupied.has(r))
  const usedRooms = ALL_ROOMS.filter(r => eveningOccupied.has(r))

  const fmtRate = (r: number | null) => r != null ? r.toFixed(1) + '%' : '-'
  const rateColor = (r: number | null) =>
    r == null ? 'text-muted-foreground' :
    r >= 80 ? 'text-green-600' :
    r >= 50 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">
          {format(now, 'yyyy년 M월 d일')} {isWeekend ? '(주말)' : '(평일)'} 기준
        </p>
      </div>

      {/* ── 오늘 개강 배너 ────────────────────────────────── */}
      {todayOpening.length > 0 && (
        <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl animate-pulse">🎉</span>
            <div>
              <p className="text-xl font-bold text-emerald-800">오늘 개강!</p>
              <p className="text-sm text-emerald-600">{todayOpening.length}개 과정이 오늘 시작합니다</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayOpening.map(c => (
              <div key={c.training_id} className="bg-white rounded-lg border border-emerald-200 px-4 py-3">
                <p className="font-semibold text-sm leading-snug">{c.course_name}</p>
                <div className="flex gap-2 mt-1 text-xs text-emerald-700">
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                    {TYPE_LABEL[c.type] ?? c.type}
                  </Badge>
                  {c.room_number && <span className="self-center">{c.room_number}호</span>}
                  {c.instructor && <span className="self-center text-gray-500">{c.instructor}</span>}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{c.start_date} ~ {c.end_date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 개강 예정 / 종강 임박 ──────────────────────────── */}
      {(openingSoon.length > 0 || closingSoon.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">

          {/* 5일 이내 개강 예정 */}
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>📅</span> 개강 예정
                <Badge className="ml-1 bg-blue-100 text-blue-700 hover:bg-blue-100">{openingSoon.length}개</Badge>
              </CardTitle>
              <CardDescription>오늘부터 5일 이내 개강 과정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {openingSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground">해당 없음</p>
              ) : openingSoon.map(c => (
                <div key={c.training_id} className="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded px-2 py-1 whitespace-nowrap shrink-0">
                    {dDayLabel(c.start_date)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{c.course_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.start_date} · {TYPE_LABEL[c.type] ?? c.type}
                      {c.instructor ? ` · ${c.instructor}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 3일 이내 종강 임박 */}
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>⏰</span> 종강 임박
                <Badge className="ml-1 bg-red-100 text-red-700 hover:bg-red-100">{closingSoon.length}개</Badge>
              </CardTitle>
              <CardDescription>오늘부터 3일 이내 종강 과정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {closingSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground">해당 없음</p>
              ) : closingSoon.map(c => {
                const isToday = c.end_date === today
                return (
                  <div key={c.training_id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${isToday ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-100'}`}>
                    <span className={`text-xs font-bold rounded px-2 py-1 whitespace-nowrap shrink-0 ${isToday ? 'bg-red-200 text-red-700' : 'bg-orange-100 text-orange-600'}`}>
                      {isToday ? '오늘종강' : dDayLabel(c.end_date)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{c.course_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        종강 {c.end_date} · {TYPE_LABEL[c.type] ?? c.type}
                        {c.instructor ? ` · ${c.instructor}` : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

        </div>
      )}

      {/* 요약 통계 */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 과정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCourses}</div>
            <p className="text-xs text-muted-foreground mt-1">등록된 총 과정</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">현재 진행 중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{ongoingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">오늘 기준 진행 과정</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{prevMonthLabel} 모집률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-3xl font-bold ${rateColor(prevMonthRate)}`}>
                {fmtRate(prevMonthRate)}
              </div>
              {rateDiff != null && (
                <span className={`text-xs font-semibold ${diffColor(rateDiff)}`}>
                  {fmtDiff(rateDiff)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{prevPrevMonthLabel} 대비 · 개강일 기준</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{prevMonthLabel} 수료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={`text-3xl font-bold ${rateColor(prevMonthCompletion)}`}>
                {fmtRate(prevMonthCompletion)}
              </div>
              {completionDiff != null && (
                <span className={`text-xs font-semibold ${diffColor(completionDiff)}`}>
                  {fmtDiff(completionDiff)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{prevPrevMonthLabel} 대비 · 수료인원 ÷ 수강생</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">오늘 빈 강의실</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{emptyRooms.length}</div>
            <p className="text-xs text-muted-foreground mt-1">19시 이후 · {ALL_ROOMS.length}개 중</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 카테고리 1: 과정 운영 ─────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>📚</span> 과정 운영
        </h3>
        <div className="grid gap-4 md:grid-cols-2">

          <Link href="/courses" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-blue-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">📚</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-blue-600 transition-colors">과정 관리</CardTitle>
                      <CardDescription className="text-xs mt-0.5">전체 과정 목록 조회 및 관리</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-blue-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{totalCourses}</span>
                  <span className="text-sm text-muted-foreground">개 과정 등록됨</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(ongoingByType).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {TYPE_LABEL[type] || type} {count}
                    </Badge>
                  ))}
                  {ongoingCount > 0 && (
                    <span className="text-xs text-muted-foreground self-center">진행 중 {ongoingCount}개</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/attendance" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-violet-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-violet-600 transition-colors">출석부</CardTitle>
                      <CardDescription className="text-xs mt-0.5">과정별 수강생 출석 현황 관리</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-violet-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-violet-600">{ongoingCount}</span>
                  <span className="text-sm text-muted-foreground">개 과정 진행 중</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">과정을 선택하여 수강생 출석부를 확인하세요</p>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* ── 카테고리 2: 강의실 관리 ───────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>🏫</span> 강의실 관리
        </h3>
        <div className="grid gap-4 md:grid-cols-2">

          <Link href="/empty-rooms" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-green-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">🏫</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-green-600 transition-colors">빈 강의장</CardTitle>
                      <CardDescription className="text-xs mt-0.5">시간대별 빈 강의장 현황 조회</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-green-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-green-600">{emptyRooms.length}</span>
                  <span className="text-sm text-muted-foreground">개 사용 가능 (19시 이후)</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ALL_ROOMS.map(room => (
                    <span
                      key={room}
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        eveningOccupied.has(room)
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {room}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/room-schedule" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-amber-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🗓️</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-amber-600 transition-colors">강의장 시간표</CardTitle>
                      <CardDescription className="text-xs mt-0.5">강의장별 전체 수업 시간표</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-amber-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-amber-600">{ALL_ROOMS.length}</span>
                  <span className="text-sm text-muted-foreground">개 강의실 시간표</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">날짜·강의실별 수업 배치 현황을 확인하세요</p>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* ── 이번 달 예상매출 ─────────────────────────────── */}
      <Link href="/revenue" className="group block">
        <Card className="hover:shadow-md transition-all border-2 hover:border-yellow-300 cursor-pointer border-yellow-200 bg-yellow-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center text-2xl flex-shrink-0">💰</div>
                <div>
                  <CardTitle className="text-base group-hover:text-yellow-700 transition-colors">
                    {currentMonth}월 국비지원 예상매출
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">단위기간 기준 지급 예정액</CardDescription>
                </div>
              </div>
              <span className="text-muted-foreground group-hover:text-yellow-600 transition-colors text-lg">→</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-bold text-yellow-700">{fmtWon(monthTotal)}</span>
              <span className="text-sm text-muted-foreground">이번 달 합계</span>
            </div>
            {monthPeriods.length > 0 ? (
              <div className="space-y-2">
                {monthPeriods.map(p => p.total > 0 && (
                  <div key={p.id} className="flex items-center justify-between text-sm rounded-lg bg-white border border-yellow-100 px-3 py-2">
                    <div>
                      <span className="font-medium text-gray-700">{p.half === 1 ? '상반월' : '하반월'}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.label.replace(/\d{4}년 \d+월 /, '')}</span>
                      <span className="text-xs text-blue-500 ml-2">→ {p.paymentDate} 지급</span>
                    </div>
                    <span className="font-semibold text-gray-800">{fmtWon(p.total)}</span>
                  </div>
                ))}
                <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                  {monthByType.NATIONAL > 0 && <span className="text-red-600">국기 {fmtWon(monthByType.NATIONAL)}</span>}
                  {monthByType.UNEMPLOYED > 0 && <span className="text-orange-600">실업자 {fmtWon(monthByType.UNEMPLOYED)}</span>}
                  {monthByType.EMPLOYED > 0 && <span className="text-blue-600">재직자 {fmtWon(monthByType.EMPLOYED)}</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">이번 달 예상매출 데이터 없음</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* ── 카테고리 3: 분석 & 통계 ───────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>📊</span> 분석 & 통계
        </h3>
        <div className="grid gap-4 md:grid-cols-3">

          <Link href="/instructors" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-orange-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">👨‍🏫</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-orange-600 transition-colors">강사별 수업시간</CardTitle>
                      <CardDescription className="text-xs mt-0.5">월별 수업시간 집계 및 엑셀 내보내기</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-orange-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-orange-600">{instructorCount}</span>
                  <span className="text-sm text-muted-foreground">명 강사 (2026년)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">일정변경·취업특강 반영 집계</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/statistics" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-indigo-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">📈</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-indigo-600 transition-colors">통계</CardTitle>
                      <CardDescription className="text-xs mt-0.5">구분별 모집률·수료율 통계</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-indigo-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div>
                    <div className={`text-xl font-bold ${rateColor(prevMonthRate)}`}>{fmtRate(prevMonthRate)}</div>
                    <p className="text-xs text-muted-foreground">{prevMonthLabel} 모집률</p>
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${rateColor(prevMonthCompletion)}`}>{fmtRate(prevMonthCompletion)}</div>
                    <p className="text-xs text-muted-foreground">{prevMonthLabel} 수료율</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">개강일 기준 조회 기간 설정 가능</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/competitors" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-rose-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center text-2xl flex-shrink-0">🔍</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-rose-600 transition-colors">경쟁기관</CardTitle>
                      <CardDescription className="text-xs mt-0.5">HRD-Net 기반 경쟁 학원 현황</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-rose-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">MBC아카데미 · 한국아이티 · 그린컴퓨터</p>
                <p className="text-xs text-muted-foreground mt-2">지역·개강일·훈련유형 필터 지원</p>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* 오늘 강의실 상세 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>오늘 19시 이후 강의실 현황</CardTitle>
            <CardDescription>
              {format(now, 'yyyy년 M월 d일')} {isWeekend ? '(주말)' : '(평일)'}
              &nbsp;· 사용 중 {usedRooms.length}개 / 빈 강의실 {emptyRooms.length}개
            </CardDescription>
          </div>
          <Link href="/empty-rooms">
            <span className="text-sm text-blue-500 hover:text-blue-700 hover:underline">상세보기 →</span>
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          {emptyRooms.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2">사용 가능 ({emptyRooms.length}개)</h4>
              <div className="flex flex-wrap gap-2">
                {emptyRooms.map(room => (
                  <div key={room} className="px-4 py-2 rounded-lg bg-green-50 border-2 border-green-300">
                    <p className="text-base font-bold text-green-700">{room}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {usedRooms.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">사용 중 ({usedRooms.length}개)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {usedRooms.map(room => {
                  const info = eveningOccupied.get(room)!
                  return (
                    <div key={room} className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
                      <div className="text-center bg-red-100 rounded-lg px-3 py-2 flex-shrink-0">
                        <p className="text-base font-bold text-red-700">{room}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{info.courseName}</p>
                        <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{TYPE_LABEL[info.type || ''] || info.type}</span>
                          {info.instructor && <><span>|</span><span>{info.instructor}</span></>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {usedRooms.length === 0 && (
            <p className="text-sm text-muted-foreground">19시 이후 수업이 없습니다</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
