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
  periodDays: number   // 단위기간 내 수업일수
  totalDays: number    // 과정 전체 수업일수
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
  today: string
  periods: UnitPeriod[]
  annualByType: { NATIONAL: number; UNEMPLOYED: number; EMPLOYED: number }
  annualTotal: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = { NATIONAL: '국기', UNEMPLOYED: '실업자', EMPLOYED: '재직자' }
const TYPE_COLOR: Record<string, string> = {
  NATIONAL: 'bg-red-100 text-red-800',
  UNEMPLOYED: 'bg-orange-100 text-orange-800',
  EMPLOYED: 'bg-blue-100 text-blue-800',
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

function isPast(paymentDate: string, today: string): boolean {
  return paymentDate < today
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
  const [showAll, setShowAll] = useState(false)

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

  const today = data?.today ?? new Date().toISOString().slice(0, 10)

  // 매출이 있는 단위기간만 표시 (기본: 지급일이 오늘 이후만, showAll이면 전체)
  const activePeriods = data?.periods.filter((p) => {
    const hasRevenue =
      typeFilter === 'ALL' ? p.total > 0
      : typeFilter === 'NATIONAL' ? p.totalByType.NATIONAL > 0
      : typeFilter === 'UNEMPLOYED' ? p.totalByType.UNEMPLOYED > 0
      : p.totalByType.EMPLOYED > 0
    if (!hasRevenue) return false
    if (showAll) return true
    return p.paymentDate >= today
  })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">국비지원 예상매출</h2>
        <p className="text-muted-foreground">
          현재 운영 중인 과정의 단위기간별 훈련비 지급 예정액
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
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
                      typeFilter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowAll((v) => !v)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                showAll ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showAll ? '전체 표시 중' : '미지급 예정만'}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-4 rounded-md border border-red-200">{error}</div>
      )}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">데이터를 불러오는 중...</div>
      )}

      {data && !loading && (
        <>
          {/* 안내 문구 */}
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            {year}년 단위기간에 수업이 있는 과정 전체 기준 ·
            계산식: 훈련비 × (단위기간 수업일수 / 전체 수업일수) × 인원 × 지원율
          </div>

          {/* 연간 요약 카드 */}
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
                <p className="text-xs text-gray-500 font-medium mb-1">합계 (현운영과정)</p>
                <p className="text-2xl font-bold text-gray-800">{formatWon(data.annualTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatWonFull(data.annualTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {/* 단위기간별 테이블 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                단위기간별 예상매출
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({activePeriods?.length ?? 0}개 단위기간)
                </span>
              </CardTitle>
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
                      <th className="px-3 py-3 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activePeriods ?? []).map((period) => {
                      const isExpanded = expandedPeriods.has(period.id)
                      const past = isPast(period.paymentDate, today)
                      const filteredCourses =
                        typeFilter === 'ALL' ? period.courses
                        : period.courses.filter((c) => c.type === typeFilter)

                      const displayTotal =
                        typeFilter === 'ALL' ? period.total
                        : typeFilter === 'NATIONAL' ? period.totalByType.NATIONAL
                        : typeFilter === 'UNEMPLOYED' ? period.totalByType.UNEMPLOYED
                        : period.totalByType.EMPLOYED

                      return (
                        <>
                          <tr
                            key={period.id}
                            className={`border-b cursor-pointer transition-colors ${
                              past ? 'opacity-50 hover:opacity-70' : 'hover:bg-gray-50'
                            } ${period.half === 2 ? 'bg-gray-50/40' : ''}`}
                            onClick={() => togglePeriod(period.id)}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">
                              {period.paymentDate}
                              {past && (
                                <span className="ml-1 text-[10px] text-gray-400">(완료)</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {period.label}
                              <span className="ml-2 text-xs text-gray-400">
                                ({filteredCourses.length}과정)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-red-700 font-medium">
                              {typeFilter === 'ALL' || typeFilter === 'NATIONAL'
                                ? formatWon(period.totalByType.NATIONAL) : ''}
                            </td>
                            <td className="px-4 py-3 text-right text-orange-700 font-medium">
                              {typeFilter === 'ALL' || typeFilter === 'UNEMPLOYED'
                                ? formatWon(period.totalByType.UNEMPLOYED) : ''}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-700 font-medium">
                              {typeFilter === 'ALL' || typeFilter === 'EMPLOYED'
                                ? formatWon(period.totalByType.EMPLOYED) : ''}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              {formatWon(displayTotal)}
                            </td>
                            <td className="px-3 py-3 text-center text-gray-400 text-xs">
                              {isExpanded ? '▲' : '▼'}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr key={`${period.id}-detail`}>
                              <td colSpan={7} className="p-0 border-b">
                                <div className="bg-slate-50 px-6 py-3">
                                  {filteredCourses.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-3">
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
                                          <th className="text-right py-2 px-2 font-semibold">수업일(기간/전체)</th>
                                          <th className="text-right py-2 px-2 font-semibold">비율</th>
                                          <th className="text-right py-2 px-2 font-semibold">훈련비</th>
                                          <th className="text-right py-2 px-2 font-semibold">인원</th>
                                          <th className="text-right py-2 px-2 font-semibold">지원율</th>
                                          <th className="text-right py-2 px-2 font-semibold">예상매출</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredCourses
                                          .sort((a, b) => b.revenue - a.revenue)
                                          .map((c) => (
                                            <tr key={c.trainingId} className="border-b border-gray-100 hover:bg-white">
                                              <td className="py-2 px-2 text-gray-400">{c.trainingId}</td>
                                              <td className="py-2 px-2 font-medium text-gray-800 max-w-[200px] truncate">
                                                {c.courseName}
                                              </td>
                                              <td className="py-2 px-2 text-gray-500">{c.instructor || '-'}</td>
                                              <td className="py-2 px-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLOR[c.type] || 'bg-gray-100 text-gray-700'}`}>
                                                  {TYPE_LABEL[c.type] || c.type}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2 text-right font-mono">
                                                <span className="text-blue-600 font-semibold">{c.periodDays}</span>
                                                <span className="text-gray-400">/{c.totalDays}일</span>
                                              </td>
                                              <td className="py-2 px-2 text-right text-gray-600">
                                                {((c.periodDays / c.totalDays) * 100).toFixed(1)}%
                                              </td>
                                              <td className="py-2 px-2 text-right">{c.tuition.toLocaleString()}원</td>
                                              <td className="py-2 px-2 text-right">{c.students}명</td>
                                              <td className="py-2 px-2 text-right">{(c.multiplier * 100).toFixed(0)}%</td>
                                              <td className="py-2 px-2 text-right font-bold text-gray-800">
                                                {c.revenue.toLocaleString()}원
                                              </td>
                                            </tr>
                                          ))}
                                        <tr className="bg-gray-100 font-semibold">
                                          <td colSpan={9} className="py-2 px-2 text-right text-gray-600">소계</td>
                                          <td className="py-2 px-2 text-right text-gray-900">
                                            {filteredCourses.reduce((s, c) => s + c.revenue, 0).toLocaleString()}원
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

                  {(activePeriods?.length ?? 0) > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                        <td colSpan={2} className="px-4 py-3 text-gray-700">합계</td>
                        <td className="px-4 py-3 text-right text-red-700">
                          {typeFilter === 'ALL' || typeFilter === 'NATIONAL'
                            ? formatWon((activePeriods ?? []).reduce((s, p) => s + p.totalByType.NATIONAL, 0)) : ''}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-700">
                          {typeFilter === 'ALL' || typeFilter === 'UNEMPLOYED'
                            ? formatWon((activePeriods ?? []).reduce((s, p) => s + p.totalByType.UNEMPLOYED, 0)) : ''}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-700">
                          {typeFilter === 'ALL' || typeFilter === 'EMPLOYED'
                            ? formatWon((activePeriods ?? []).reduce((s, p) => s + p.totalByType.EMPLOYED, 0)) : ''}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatWon((activePeriods ?? []).reduce((s, p) => s + p.total, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {(activePeriods?.length ?? 0) === 0 && !loading && (
                <div className="text-center py-8 text-gray-400">
                  현재 운영 중인 과정이 없거나 조건에 맞는 데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
