'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const TYPE_ORDER = ['EMPLOYED', 'UNEMPLOYED', 'NATIONAL', 'GENERAL', 'ASSESSMENT', 'KDT', 'INDUSTRY']

interface TypeStat {
  type: string
  typeLabel: string
  count: number
  avgRate3m: number | null
  avgRate6m: number | null
}

interface CourseEmpl {
  courseName: string
  type: string
  capacity: number
  students: number
  eiEmplRate3: string | null
  eiEmplRate6: string | null
  finiCnt: number | null
  totTrpCnt: number | null
}

interface EmploymentData {
  totalQueried: number
  totalWithData: number
  avgRate3m: number | null
  avgRate6m: number | null
  typeStats: TypeStat[]
  courses: CourseEmpl[]
}

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
  NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
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

export default function EmploymentStats({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<EmploymentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
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
    ? [...data.courses].sort((a, b) => Number(b.eiEmplRate6 ?? 0) - Number(a.eiEmplRate6 ?? 0))
    : []

  return (
    <div className="space-y-4">
      {/* 헤더 + 조회 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">취업률 현황</h3>
          <p className="text-sm text-muted-foreground">
            HRD-Net 고용보험 기준 · 종료된 과정만 조회 가능 (최대 1분 소요)
          </p>
        </div>
        <Button onClick={fetchData} disabled={loading} variant="outline">
          {loading ? '조회 중...' : data ? '다시 조회' : '취업률 조회'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-500 px-1">{error}</div>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className="grid gap-4 md:grid-cols-4">
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
                <CardDescription>6개월 취업률 기준 내림차순 · 취업률 데이터가 있는 과정만 표시</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[280px]">과정명</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead className="text-right">정원</TableHead>
                      <TableHead className="text-right">수강생</TableHead>
                      <TableHead className="text-right">수료인원</TableHead>
                      <TableHead className="text-right">취업률 (3개월)</TableHead>
                      <TableHead className="text-right">취업률 (6개월)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCourses.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{c.courseName}</TableCell>
                        <TableCell className="text-sm">{TYPE_LABEL[c.type] || c.type}</TableCell>
                        <TableCell className="text-right">{c.capacity > 0 ? c.capacity + '명' : '-'}</TableCell>
                        <TableCell className="text-right">{c.students > 0 ? c.students + '명' : '-'}</TableCell>
                        <TableCell className="text-right">{c.finiCnt != null ? c.finiCnt + '명' : '-'}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
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
