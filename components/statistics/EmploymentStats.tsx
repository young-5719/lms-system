'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const TYPE_ORDER = ['NATIONAL', 'ASSESSMENT', 'INDUSTRY', 'KDT']

const TYPE_SHORT: Record<string, string> = {
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  INDUSTRY: '산대특',
  KDT: 'KDT',
}

const TYPE_BADGE: Record<string, string> = {
  NATIONAL: 'bg-blue-100 text-blue-700',
  ASSESSMENT: 'bg-purple-100 text-purple-700',
  INDUSTRY: 'bg-orange-100 text-orange-700',
  KDT: 'bg-green-100 text-green-700',
}

interface TypeStat {
  type: string
  typeLabel: string
  count: number
  avgRate3m: number | null
  avgRate6m: number | null
}

interface CourseEmpl {
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
}

interface EmploymentData {
  totalQueried: number
  totalWithData: number
  avgRate3m: number | null
  avgRate6m: number | null
  avgCompletionRate: number | null
  avgSatisfyScore: number | null
  typeStats: TypeStat[]
  courses: CourseEmpl[]
}

const TYPE_LABEL: Record<string, string> = {
  NATIONAL: '국가기간전략산업직종',
  ASSESSMENT: '과정평가형훈련',
  INDUSTRY: '산업구조변화대응',
  KDT: 'K-디지털 트레이닝',
}

function fmt(n: number | null) {
  return n != null ? n.toFixed(1) + '%' : '-'
}

function rateColor(n: number | null) {
  if (n == null) return 'text-muted-foreground'
  if (n >= 70) return 'font-semibold text-green-600'
  if (n >= 40) return 'font-semibold text-yellow-600'
  return 'font-semibold text-red-600'
}

function satisfyColor(n: number | null) {
  if (n == null) return 'text-muted-foreground'
  if (n >= 90) return 'font-semibold text-green-600'
  if (n >= 70) return 'font-semibold text-yellow-600'
  return 'font-semibold text-red-600'
}

// "20250101" → "25.01.01"
function fmtDate(d: string) {
  if (!d || d === '-') return '-'
  if (d.length === 8) return `${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`
  return d
}

export default function EmploymentStats({ from: initFrom, to: initTo }: { from: string; to: string }) {
  const [from, setFrom] = useState(initFrom < '2026-01-01' ? initFrom : '2025-01-01')
  const [to, setTo] = useState(initTo < '2026-01-01' ? initTo : '2025-12-31')
  const [data, setData] = useState<EmploymentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/statistics/employment?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('조회 실패')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const sortedTypeStats = data
    ? [...data.typeStats].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
    : []

  const sortedCourses = data
    ? [...data.courses].sort((a, b) => {
        const a6 = a.eiEmplRate6 != null ? Number(a.eiEmplRate6) : -1
        const b6 = b.eiEmplRate6 != null ? Number(b.eiEmplRate6) : -1
        return b6 - a6
      })
    : []

  return (
    <div className="space-y-4">
      {/* 조회 필터 */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">취업률 현황</h3>
          <p className="text-sm text-muted-foreground">
            HRD-Net 고용보험 기준 · 국기·과정평가·산대특·KDT · 종료 과정만 조회 (최대 1분 소요)
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">개강일 시작</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">개강일 종료</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={fetchData} disabled={loading} className="h-9">
            {loading ? '조회 중...' : '조회'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {loading && (
        <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          HRD-Net에서 데이터를 조회 중입니다. 과정 수에 따라 최대 1분 소요될 수 있습니다...
        </div>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="bg-slate-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">조회 과정</p>
                <div className="text-2xl font-bold">{data.totalQueried}<span className="text-sm font-normal text-muted-foreground ml-1">개</span></div>
                <p className="text-xs text-muted-foreground mt-0.5">종료된 과정</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">취업률 집계</p>
                <div className="text-2xl font-bold">{data.totalWithData}<span className="text-sm font-normal text-muted-foreground ml-1">개</span></div>
                <p className="text-xs text-muted-foreground mt-0.5">데이터 있는 과정</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">취업률 3개월</p>
                <div className={`text-2xl font-bold ${rateColor(data.avgRate3m)}`}>{fmt(data.avgRate3m)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">고용보험 기준</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">취업률 6개월</p>
                <div className={`text-2xl font-bold ${rateColor(data.avgRate6m)}`}>{fmt(data.avgRate6m)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">고용보험 기준</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">평균 수료율</p>
                <div className={`text-2xl font-bold ${rateColor(data.avgCompletionRate)}`}>{fmt(data.avgCompletionRate)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">수료 ÷ 신청</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">평균 만족도</p>
                <div className={`text-2xl font-bold ${satisfyColor(data.avgSatisfyScore)}`}>
                  {data.avgSatisfyScore != null ? data.avgSatisfyScore.toFixed(1) : '-'}
                  {data.avgSatisfyScore != null && <span className="text-sm font-normal text-muted-foreground ml-0.5">점</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">100점 만점</p>
              </CardContent>
            </Card>
          </div>

          {/* 구분별 취업률 */}
          {sortedTypeStats.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">구분별 평균 취업률</CardTitle>
                <CardDescription>취업률 데이터가 있는 과정 기준</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>구분</TableHead>
                        <TableHead className="text-right">과정 수</TableHead>
                        <TableHead className="text-right whitespace-nowrap">취업률 3개월</TableHead>
                        <TableHead className="text-right whitespace-nowrap">취업률 6개월</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTypeStats.map(s => (
                        <TableRow key={s.type}>
                          <TableCell>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_BADGE[s.type] || 'bg-gray-100 text-gray-700'}`}>
                              {TYPE_SHORT[s.type] || s.typeLabel}
                            </span>
                            <span className="ml-2 text-sm text-muted-foreground hidden sm:inline">{s.typeLabel}</span>
                          </TableCell>
                          <TableCell className="text-right">{s.count}개</TableCell>
                          <TableCell className="text-right">
                            <span className={rateColor(s.avgRate3m)}>{fmt(s.avgRate3m)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={rateColor(s.avgRate6m)}>{fmt(s.avgRate6m)}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 과정별 취업률 */}
          {sortedCourses.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">과정별 상세</CardTitle>
                <CardDescription>
                  6개월 취업률 기준 내림차순 · 전체 {sortedCourses.length}개 과정
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">과정명</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">회차</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">구분</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">개강</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">종강</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">정원</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">신청</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">수료</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">수료율</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">만족도</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">취업 3M</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">취업 6M</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCourses.map((c, i) => {
                        const completionRate = c.finiCnt != null && c.applicants > 0
                          ? (c.finiCnt / c.applicants) * 100
                          : null
                        const hasEmpl = c.eiEmplRate6 != null || c.eiEmplRate3 != null
                        return (
                          <tr
                            key={i}
                            className={`border-b transition-colors hover:bg-slate-50 ${!hasEmpl ? 'opacity-60' : ''}`}
                          >
                            {/* 과정명 */}
                            <td className="px-4 py-3 max-w-[260px]">
                              <p className="font-medium leading-snug line-clamp-2 text-sm">{c.courseName}</p>
                            </td>
                            {/* 회차 */}
                            <td className="px-3 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                {c.trprDegr}
                              </span>
                            </td>
                            {/* 구분 뱃지 */}
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${TYPE_BADGE[c.type] || 'bg-gray-100 text-gray-600'}`}>
                                {TYPE_SHORT[c.type] || c.type}
                              </span>
                            </td>
                            {/* 날짜 */}
                            <td className="px-3 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(c.startDate)}
                            </td>
                            <td className="px-3 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(c.endDate)}
                            </td>
                            {/* 인원 */}
                            <td className="px-3 py-3 text-right text-sm">
                              {c.capacity > 0 ? c.capacity : '-'}
                            </td>
                            <td className="px-3 py-3 text-right text-sm">
                              {c.applicants > 0 ? c.applicants : '-'}
                            </td>
                            <td className="px-3 py-3 text-right text-sm">
                              {c.finiCnt != null ? c.finiCnt : '-'}
                            </td>
                            {/* 수료율 */}
                            <td className="px-3 py-3 text-right">
                              <span className={`text-sm ${rateColor(completionRate)}`}>
                                {completionRate != null ? completionRate.toFixed(1) + '%' : '-'}
                              </span>
                            </td>
                            {/* 만족도 */}
                            <td className="px-3 py-3 text-right">
                              <span className={`text-sm ${satisfyColor(c.satisfyScore)}`}>
                                {c.satisfyScore != null ? c.satisfyScore.toFixed(1) : '-'}
                              </span>
                            </td>
                            {/* 취업률 */}
                            <td className="px-3 py-3 text-right">
                              <span className={`text-sm ${rateColor(c.eiEmplRate3 != null ? Number(c.eiEmplRate3) : null)}`}>
                                {c.eiEmplRate3 != null ? c.eiEmplRate3 + '%' : '-'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              {c.eiEmplRate6 != null ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                  Number(c.eiEmplRate6) >= 70 ? 'bg-green-100 text-green-700' :
                                  Number(c.eiEmplRate6) >= 40 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {c.eiEmplRate6}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                조회된 과정이 없습니다
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
