'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

const DISTRICTS = [
  '서울 전체', '강남구', '강동구', '강북구', '강서구', '관악구', '광진구',
  '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구',
  '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
]

interface CompetitorItem {
  dDay: string
  dDayNum: number
  trainType: string
  academy: string
  rawAcademy: string
  courseName: string
  round: string
  startDate: string
  endDate: string
  cost: number
  selfPay: number
  capacity: string
  address: string
  phone: string
  ncsCode: string
  link: string
  applicants: number
}

interface ApiResponse {
  district: string
  totalCount: number
  fetchedAt: string
  items: CompetitorItem[]
}

const ACADEMY_COLORS: Record<string, string> = {
  'MBC아카데미': 'bg-blue-100 text-blue-800',
  '한국아이티': 'bg-green-100 text-green-800',
  '그린컴퓨터아트학원': 'bg-emerald-100 text-emerald-800',
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function CompetitorsPage() {
  const [district, setDistrict] = useState('구로구')
  const [minOne, setMinOne] = useState(false)
  const [selectedType, setSelectedType] = useState('전체')
  const [selectedAcademy, setSelectedAcademy] = useState('전체')
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 2)
    return toDateStr(d)
  })
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ district, startDate, endDate })
      if (minOne) params.set('minOne', 'true')
      const res = await fetch(`/api/competitors?${params}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch')
      }
      const json: ApiResponse = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [district, minOne, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 훈련유형 목록 (데이터 기반)
  const uniqueTypes = data
    ? ['전체', ...Array.from(new Set(data.items.map(i => i.trainType).filter(Boolean))).sort()]
    : ['전체']

  // 학원 목록 (데이터 기반)
  const uniqueAcademies = data
    ? ['전체', ...Array.from(new Set(data.items.map(i => i.academy).filter(Boolean))).sort()]
    : ['전체']

  // 훈련유형 + 학원 필터 적용
  const filteredItems = data?.items.filter(item =>
    (selectedType === '전체' || item.trainType === selectedType) &&
    (selectedAcademy === '전체' || item.academy === selectedAcademy)
  ) ?? []

  // 학원별 통계
  const academyStats = filteredItems.reduce((acc, item) => {
    if (!acc[item.academy]) acc[item.academy] = { count: 0, totalApplicants: 0 }
    acc[item.academy].count++
    acc[item.academy].totalApplicants += item.applicants
    return acc
  }, {} as Record<string, { count: number; totalApplicants: number }>)

  function getDDayColor(dDay: string, dDayNum: number): string {
    if (dDay === '오늘개강') return 'text-red-600 font-bold'
    if (dDay === '개강함') return 'text-gray-400'
    if (dDayNum <= 7) return 'text-red-500 font-semibold'
    if (dDayNum <= 30) return 'text-orange-500 font-medium'
    return 'text-blue-600'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">경쟁기관 현황</h2>
        <p className="text-muted-foreground">
          고용24 HRD-Net API 기반 경쟁 학원 과정 현황
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">지역</label>
              <div className="w-44">
                <Select value={district} onValueChange={setDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="지역 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRICTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">개강일 시작</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">개강일 종료</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">훈련유형</label>
              <div className="w-44">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">학원</label>
              <div className="w-48">
                <Select value={selectedAcademy} onValueChange={setSelectedAcademy}>
                  <SelectTrigger>
                    <SelectValue placeholder="학원 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueAcademies.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 h-10">
              <Checkbox
                id="minOne"
                checked={minOne}
                onCheckedChange={(checked) => setMinOne(checked === true)}
              />
              <label htmlFor="minOne" className="text-sm cursor-pointer">
                신청자 1명 이상만
              </label>
            </div>
            <Button onClick={fetchData} disabled={loading} variant="outline" className="h-10">
              {loading ? '조회 중...' : '새로고침'}
            </Button>
            {data && (
              <span className="text-sm text-muted-foreground ml-auto">
                총 {data.totalCount}개 과정 | 조회: {new Date(data.fetchedAt).toLocaleString('ko-KR')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 학원별 요약 */}
      {data && Object.keys(academyStats).length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(academyStats).map(([name, stats]) => (
            <Card key={name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <Badge className={ACADEMY_COLORS[name] || 'bg-gray-100 text-gray-800'}>
                    {name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.count}개 과정</div>
                <p className="text-xs text-muted-foreground">
                  총 신청자: {stats.totalApplicants}명
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 로딩/에러 */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            데이터를 불러오는 중입니다... (최대 1분 소요)
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-12 text-center text-red-500">
            오류: {error}
          </CardContent>
        </Card>
      )}

      {/* 과정 목록 테이블 */}
      {data && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>과정 목록</CardTitle>
            <CardDescription>
              {district} 지역 경쟁기관 과정 ({filteredItems.length}개
              {selectedType !== '전체' && ` · ${selectedType}`}
              {selectedAcademy !== '전체' && ` · ${selectedAcademy}`})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                조건에 맞는 과정이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[1400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap w-[80px]">D-Day</TableHead>
                      <TableHead className="whitespace-nowrap">훈련유형</TableHead>
                      <TableHead className="whitespace-nowrap">학원</TableHead>
                      <TableHead className="whitespace-nowrap min-w-[300px]">과정명</TableHead>
                      <TableHead className="whitespace-nowrap">회차</TableHead>
                      <TableHead className="whitespace-nowrap">개강일</TableHead>
                      <TableHead className="whitespace-nowrap">종강일</TableHead>
                      <TableHead className="whitespace-nowrap text-right">훈련비</TableHead>
                      <TableHead className="whitespace-nowrap text-right">자부담</TableHead>
                      <TableHead className="whitespace-nowrap text-right">정원</TableHead>
                      <TableHead className="whitespace-nowrap text-right">신청자</TableHead>
                      <TableHead className="whitespace-nowrap">주소</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item, idx) => (
                      <TableRow key={idx} className={item.dDay === '개강함' ? 'opacity-50' : ''}>
                        <TableCell className={`whitespace-nowrap ${getDDayColor(item.dDay, item.dDayNum)}`}>
                          {item.dDay}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{item.trainType}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={ACADEMY_COLORS[item.academy] || 'bg-gray-100 text-gray-800'}>
                            {item.academy}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {item.courseName}
                            </a>
                          ) : (
                            item.courseName
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">{item.round}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.startDate}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.endDate}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {item.cost > 0 ? item.cost.toLocaleString() + '원' : '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {item.selfPay > 0 ? item.selfPay.toLocaleString() + '원' : '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{item.capacity}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium">
                          {item.applicants > 0 ? item.applicants + '명' : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {item.address.length > 25 ? item.address.substring(0, 25) + '...' : item.address}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
