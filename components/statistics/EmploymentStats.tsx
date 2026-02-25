'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const TYPE_ORDER = ['NATIONAL', 'ASSESSMENT', 'INDUSTRY', 'KDT']

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

export default function EmploymentStats({ from: initFrom, to: initTo }: { from: string; to: string }) {
  // 취업률은 과정 종료 후 3~6개월 뒤 집계 → 기본값은 전년도 과정 기준
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
        // 취업률 있는 과정 먼저, 그 다음 6개월 취업률 내림차순
        const a6 = a.eiEmplRate6 != null ? Number(a.eiEmplRate6) : -1
        const b6 = b.eiEmplRate6 != null ? Number(b.eiEmplRate6) : -1
        return b6 - a6
      })
    : []

  return (
    <div className="space-y-4">
      {/* 헤더 + 날짜 + 조회 버튼 */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">취업률 현황</h3>
          <p className="text-sm text-muted-foreground">
            HRD-Net 고용보험 기준 · 국기·기업맞춤·과정평가·산대특·KDT · 종료 과정만 조회 (최대 1분 소요)
          </p>
        </div>
        <div className="flex items-end gap-2">
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
          <Button onClick={fetchData} disabled={loading} variant="outline" className="h-9">
            {loading ? '조회 중...' : '취업률 조회'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 px-1">{error}</div>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">조회 대상 과정</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalQueried}개</div>
                <p className="text-xs text-muted-foreground">종료된 과정</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">취업률 집계 과정</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalWithData}개</div>
                <p className="text-xs text-muted-foreground">데이터 있는 과정</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">평균 취업률 (3개월)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${rateColor(data.avgRate3m)}`}>
                  {fmt(data.avgRate3m)}
                </div>
                <p className="text-xs text-muted-foreground">고용보험 기준</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">평균 취업률 (6개월)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${rateColor(data.avgRate6m)}`}>
                  {fmt(data.avgRate6m)}
                </div>
                <p className="text-xs text-muted-foreground">고용보험 기준</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">평균 수료율</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${rateColor(data.avgCompletionRate)}`}>
                  {fmt(data.avgCompletionRate)}
                </div>
                <p className="text-xs text-muted-foreground">수료인원 ÷ 신청인원</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">평균 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.avgSatisfyScore == null ? 'text-muted-foreground' : data.avgSatisfyScore >= 90 ? 'font-semibold text-green-600' : data.avgSatisfyScore >= 70 ? 'font-semibold text-yellow-600' : 'font-semibold text-red-600'}`}>
                  {data.avgSatisfyScore != null ? data.avgSatisfyScore.toFixed(1) + '점' : '-'}
                </div>
                <p className="text-xs text-muted-foreground">100점 만점</p>
              </CardContent>
            </Card>
          </div>

          {/* 구분별 취업률 */}
          {sortedTypeStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>구분별 평균 취업률</CardTitle>
                <CardDescription>취업률 데이터가 있는 과정 기준</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>구분</TableHead>
                      <TableHead className="text-right">과정 수</TableHead>
                      <TableHead className="text-right">평균 취업률 (3개월)</TableHead>
                      <TableHead className="text-right">평균 취업률 (6개월)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTypeStats.map(s => (
                      <TableRow key={s.type}>
                        <TableCell className="font-medium">{s.typeLabel}</TableCell>
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
              </CardContent>
            </Card>
          )}

          {/* 과정별 취업률 */}
          {sortedCourses.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>과정별 취업률</CardTitle>
                <CardDescription>6개월 취업률 기준 내림차순 · 전체 조회 과정 표시</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[280px]">과정명</TableHead>
                      <TableHead className="text-center whitespace-nowrap">회차</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead className="whitespace-nowrap">개강일</TableHead>
                      <TableHead className="whitespace-nowrap">종강일</TableHead>
                      <TableHead className="text-right">정원</TableHead>
                      <TableHead className="text-right">신청인원</TableHead>
                      <TableHead className="text-right">수료인원</TableHead>
                      <TableHead className="text-right">수료율</TableHead>
                      <TableHead className="text-right">만족도</TableHead>
                      <TableHead className="text-right">취업률 (3개월)</TableHead>
                      <TableHead className="text-right">취업률 (6개월)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCourses.map((c, i) => {
                      const completionRate = c.finiCnt != null && c.applicants > 0
                        ? (c.finiCnt / c.applicants) * 100
                        : null
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{c.courseName}</TableCell>
                          <TableCell className="text-center text-sm">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                              {c.trprDegr}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{c.typeLabel || TYPE_LABEL[c.type] || c.type}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{c.startDate}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{c.endDate}</TableCell>
                          <TableCell className="text-right">{c.capacity > 0 ? c.capacity + '명' : '-'}</TableCell>
                          <TableCell className="text-right">{c.applicants > 0 ? c.applicants + '명' : '-'}</TableCell>
                          <TableCell className="text-right">{c.finiCnt != null ? c.finiCnt + '명' : '-'}</TableCell>
                          <TableCell className="text-right">
                            <span className={rateColor(completionRate)}>
                              {completionRate != null ? completionRate.toFixed(1) + '%' : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.satisfyScore != null ? (
                              <span className={c.satisfyScore >= 90 ? 'font-semibold text-green-600' : c.satisfyScore >= 70 ? 'font-semibold text-yellow-600' : 'font-semibold text-red-600'}>
                                {c.satisfyScore.toFixed(1)}점
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={rateColor(c.eiEmplRate3 != null ? Number(c.eiEmplRate3) : null)}>
                              {c.eiEmplRate3 != null ? c.eiEmplRate3 + '%' : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={rateColor(c.eiEmplRate6 != null ? Number(c.eiEmplRate6) : null)}>
                              {c.eiEmplRate6 != null ? c.eiEmplRate6 + '%' : '-'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                취업률 집계 데이터가 있는 과정이 없습니다
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
