'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseRevenue {
  trainingId: number
  courseName: string
  instructor: string
  type: string
  startDate: string
  endDate: string
  trainingDays: number
  dailyHours: number
  tuition: number
  students: number
  multiplier: number
  revenue: number
}

interface UnitPeriod {
  id: string
  label: string
  start: string
  end: string
  paymentDate: string
  month: number
  half: number
  courses: CourseRevenue[]
  totalByType: { NATIONAL: number; UNEMPLOYED: number; EMPLOYED: number }
  total: number
}

interface RevenueData {
  year: number
  periods: UnitPeriod[]
  annualByType: { NATIONAL: number; UNEMPLOYED: number; EMPLOYED: number }
  annualTotal: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  NATIONAL: '국기',
  UNEMPLOYED: '실업자',
  EMPLOYED: '재직자',
}

const TYPE_COLOR: Record<string, string> = {
  NATIONAL: 'bg-red-100 text-red-800',
  UNEMPLOYED: 'bg-orange-100 text-orange-800',
  EMPLOYED: 'bg-blue-100 text-blue-800',
}

const TYPE_HEADER_COLOR: Record<string, string> = {
  NATIONAL: 'text-red-600',
  UNEMPLOYED: 'text-orange-600',
  EMPLOYED: 'text-blue-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWon(n: number): string {
  if (n === 0) return '-'
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000)
    const man = Math.floor((n % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return `${n.toLocaleString()}원`
}

function formatWonFull(n: number): string {
  return n === 0 ? '-' : `${n.toLocaleString()}원`
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  const fetchData = useCallback(async (y: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/revenue?year=${y}`)
      if (!res.ok) throw new Error('조회 실패')
      setData(await res.json())
    } catch {
      setError('데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(year)
  }, [year, fetchData])

  const togglePeriod = (id: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 지급일 기준으로 데이터 정렬 (이미 월 순서대로 정렬됨)
  const filteredPeriods = data?.periods.filter((p) => {
    if (typeFilter === 'ALL') return p.total > 0
    if (typeFilter === 'NATIONAL') return p.totalByType.NATIONAL > 0
    if (typeFilter === 'UNEMPLOYED') return p.totalByType.UNEMPLOYED > 0
    if (typeFilter === 'EMPLOYED') return p.totalByType.EMPLOYED > 0
    return p.total > 0
  })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">국비지원 예상매출</h2>
        <p className="text-muted-foreground">
          단위기간별 훈련비 지급 예정 금액 (훈련일수 × 일일시간 × 훈련단가 × 인원 × 지원율)
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 연도 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">연도</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>

            {/* 구분 필터 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">구분</label>
              <div className="flex gap-1">
                {[
                  { key: 'ALL', label: '전체' },
                  { key: 'NATIONAL', label: '국기' },
                  { key: 'UNEMPLOYED', label: '실업자' },
                  { key: 'EMPLOYED', label: '재직자' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      typeFilter === key
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-4 rounded-md border border-red-200">{error}</div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">데이터를 불러오는 중...</div>
      )}

      {/* 연간 요약 카드 */}
      {data && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-red-200">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-red-500 font-medium mb-1">국기 (×0.95)</p>
                <p className="text-2xl font-bold text-red-700">{formatWon(data.annualByType.NATIONAL)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatWonFull(data.annualByType.NATIONAL)}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-orange-500 font-medium mb-1">실업자 (×0.70)</p>
                <p className="text-2xl font-bold text-orange-700">{formatWon(data.annualByType.UNEMPLOYED)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatWonFull(data.annualByType.UNEMPLOYED)}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-blue-500 font-medium mb-1">재직자 (×0.60)</p>
                <p className="text-2xl font-bold text-blue-700">{formatWon(data.annualByType.EMPLOYED)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatWonFull(data.annualByType.EMPLOYED)}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-300 bg-gray-50">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-gray-500 font-medium mb-1">{year}년 연간 합계</p>
                <p className="text-2xl font-bold text-gray-800">{formatWon(data.annualTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatWonFull(data.annualTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {/* 단위기간별 테이블 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">단위기간별 예상매출</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 w-[110px]">지급일</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">단위기간</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-600 w-[130px]">국기</th>
                      <th className="text-right px-4 py-3 font-semibold text-orange-600 w-[130px]">실업자</th>
                      <th className="text-right px-4 py-3 font-semibold text-blue-600 w-[130px]">재직자</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700 w-[140px]">합계</th>
                      <th className="px-3 py-3 w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredPeriods ?? []).map((period) => {
                      const isExpanded = expandedPeriods.has(period.id)
                      const filteredCourses =
                        typeFilter === 'ALL'
                          ? period.courses
                          : period.courses.filter((c) => c.type === typeFilter)

                      return (
                        <>
                          <tr
                            key={period.id}
                            className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                              period.half === 1 ? '' : 'bg-gray-50/50'
                            }`}
                            onClick={() => togglePeriod(period.id)}
                          >
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              {period.paymentDate}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {period.label}
                              <span className="ml-2 text-xs text-gray-400">
                                ({filteredCourses.length}개 과정)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-red-700 font-medium">
                              {typeFilter === 'ALL' || typeFilter === 'NATIONAL'
                                ? formatWon(period.totalByType.NATIONAL)
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-orange-700 font-medium">
                              {typeFilter === 'ALL' || typeFilter === 'UNEMPLOYED'
                                ? formatWon(period.totalByType.UNEMPLOYED)
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-700 font-medium">
                              {typeFilter === 'ALL' || typeFilter === 'EMPLOYED'
                                ? formatWon(period.totalByType.EMPLOYED)
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatWon(
                                typeFilter === 'ALL'
                                  ? period.total
                                  : typeFilter === 'NATIONAL'
                                  ? period.totalByType.NATIONAL
                                  : typeFilter === 'UNEMPLOYED'
                                  ? period.totalByType.UNEMPLOYED
                                  : period.totalByType.EMPLOYED
                              )}
                            </td>
                            <td className="px-3 py-3 text-center text-gray-400">
                              {isExpanded ? '▲' : '▼'}
                            </td>
                          </tr>

                          {/* 상세 펼치기 */}
                          {isExpanded && (
                            <tr key={`${period.id}-detail`}>
                              <td colSpan={7} className="p-0">
                                <div className="bg-gray-50 border-b px-4 py-3">
                                  {filteredCourses.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-2">
                                      해당 기간에 수업이 있는 과정이 없습니다
                                    </p>
                                  ) : (
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="text-gray-500 border-b border-gray-200">
                                          <th className="text-left py-2 px-2 font-semibold">ID</th>
                                          <th className="text-left py-2 px-2 font-semibold">과정명</th>
                                          <th className="text-left py-2 px-2 font-semibold">강사</th>
                                          <th className="text-center py-2 px-2 font-semibold">구분</th>
                                          <th className="text-right py-2 px-2 font-semibold">훈련일수</th>
                                          <th className="text-right py-2 px-2 font-semibold">일일시간</th>
                                          <th className="text-right py-2 px-2 font-semibold">훈련단가</th>
                                          <th className="text-right py-2 px-2 font-semibold">인원</th>
                                          <th className="text-right py-2 px-2 font-semibold">지원율</th>
                                          <th className="text-right py-2 px-2 font-semibold">예상매출</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredCourses
                                          .sort((a, b) => b.revenue - a.revenue)
                                          .map((c) => (
                                            <tr
                                              key={c.trainingId}
                                              className="border-b border-gray-100 hover:bg-white"
                                            >
                                              <td className="py-2 px-2 text-gray-400">{c.trainingId}</td>
                                              <td className="py-2 px-2 font-medium text-gray-800 max-w-[220px] truncate">
                                                {c.courseName}
                                              </td>
                                              <td className="py-2 px-2 text-gray-500">{c.instructor || '-'}</td>
                                              <td className="py-2 px-2 text-center">
                                                <span
                                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLOR[c.type] || 'bg-gray-100 text-gray-700'}`}
                                                >
                                                  {TYPE_LABEL[c.type] || c.type}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2 text-right">{c.trainingDays}일</td>
                                              <td className="py-2 px-2 text-right">{c.dailyHours}h</td>
                                              <td className="py-2 px-2 text-right">
                                                {c.tuition.toLocaleString()}원
                                              </td>
                                              <td className="py-2 px-2 text-right">{c.students}명</td>
                                              <td className="py-2 px-2 text-right">
                                                {(c.multiplier * 100).toFixed(0)}%
                                              </td>
                                              <td className="py-2 px-2 text-right font-bold text-gray-800">
                                                {c.revenue.toLocaleString()}원
                                              </td>
                                            </tr>
                                          ))}
                                        {/* 소계 */}
                                        <tr className="bg-gray-100 font-semibold">
                                          <td colSpan={9} className="py-2 px-2 text-right text-gray-600">
                                            소계
                                          </td>
                                          <td className="py-2 px-2 text-right text-gray-900">
                                            {filteredCourses
                                              .reduce((s, c) => s + c.revenue, 0)
                                              .toLocaleString()}
                                            원
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>

                  {/* 합계 행 */}
                  {data && (filteredPeriods?.length ?? 0) > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                        <td colSpan={2} className="px-4 py-3 text-gray-700">
                          {year}년 합계
                        </td>
                        <td className="px-4 py-3 text-right text-red-700">
                          {typeFilter === 'ALL' || typeFilter === 'NATIONAL'
                            ? formatWon(data.annualByType.NATIONAL)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-700">
                          {typeFilter === 'ALL' || typeFilter === 'UNEMPLOYED'
                            ? formatWon(data.annualByType.UNEMPLOYED)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-700">
                          {typeFilter === 'ALL' || typeFilter === 'EMPLOYED'
                            ? formatWon(data.annualByType.EMPLOYED)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {typeFilter === 'ALL'
                            ? formatWon(data.annualTotal)
                            : typeFilter === 'NATIONAL'
                            ? formatWon(data.annualByType.NATIONAL)
                            : typeFilter === 'UNEMPLOYED'
                            ? formatWon(data.annualByType.UNEMPLOYED)
                            : formatWon(data.annualByType.EMPLOYED)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {(filteredPeriods?.length ?? 0) === 0 && !loading && (
                <div className="text-center py-8 text-gray-400">
                  해당 조건에 맞는 데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
