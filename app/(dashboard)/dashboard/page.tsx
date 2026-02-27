import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'
import CourseSummary from '@/components/dashboard/CourseSummary'

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const isWeekend = now.getDay() === 0 || now.getDay() === 6

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

  const rateDiff = prevMonthRate != null && prevPrevMonthRate != null ? prevMonthRate - prevPrevMonthRate : null
  const completionDiff = prevMonthCompletion != null && prevPrevMonthCompletion != null ? prevMonthCompletion - prevPrevMonthCompletion : null
  const fmtDiff = (d: number | null) => d == null ? null : (d >= 0 ? `+${d.toFixed(1)}%p` : `${d.toFixed(1)}%p`)
  const diffColor = (d: number | null) => d == null ? '' : d >= 0 ? 'text-green-600' : 'text-red-500'

  // ── 빈강의장 API 호출 ────────────────────────────────────────
  type SlotInfo = { occupied: boolean; courseName?: string; instructor?: string; type?: string }
  let roomMatrix: Record<string, Record<string, SlotInfo>> = {}
  try {
    const res = await fetch(`${baseUrl}/api/empty-rooms?date=${today}`, fetchOpts)
    if (res.ok) { const d = await res.json(); roomMatrix = d.matrix || {} }
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

  // DB에서 출석부용 진행 중 과정 수 (출석부 카드용)
  const { count: ongoingCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .lte('start_date', today)
    .gte('end_date', today)

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">
          {format(now, 'yyyy년 M월 d일')} {isWeekend ? '(주말)' : '(평일)'} 기준
        </p>
      </div>

      {/* ── 엑셀 기반 개강 / 종강 현황 (훈련 주간 달력 연동) ── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>📆</span> 개강·종강 현황
          <span className="text-xs font-normal text-slate-400 ml-1">훈련 주간 달력 업로드 기준</span>
        </h3>
        <CourseSummary />
      </div>

      {/* 요약 통계 */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
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
                <p className="text-xs text-muted-foreground">과정 정보를 조회하고 관리합니다</p>
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
                  <span className="text-2xl font-bold text-violet-600">{ongoingCount ?? 0}</span>
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

          <Link href="/training-calendar" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-blue-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">📅</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-blue-600 transition-colors">훈련 주간 달력</CardTitle>
                      <CardDescription className="text-xs mt-0.5">엑셀 시간표 업로드 · 날짜별 강의장 현황</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-blue-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  폴더·파일 업로드로 과정별 시간표를 관리하고<br />날짜 클릭으로 강의장 현황을 확인하세요
                </p>
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
        <div className="grid gap-4 md:grid-cols-2">

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
          <Link href="/room-schedule">
            <span className="text-sm text-blue-500 hover:text-blue-700 hover:underline">강의장 시간표 →</span>
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
                        {info.instructor && (
                          <p className="text-xs text-gray-500 mt-0.5">{info.instructor}</p>
                        )}
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
