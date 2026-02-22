'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
  NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
}

export interface SessionDetail {
  date: string       // "2026-01-05"
  dayOfWeek: string  // "월"
  hours: number      // 5.0
}

export interface MonthCourseDetail {
  name: string
  type: string
  roomNumber: string
  hours: number
  days: number
  sessions: SessionDetail[]
}

export interface InstructorData {
  name: string
  totalHours: number
  monthly: Record<string, { total: number; courses: MonthCourseDetail[] }>
}

interface Props {
  instructor: InstructorData
  allMonths: string[]
}

export default function InstructorDetailView({ instructor, allMonths }: Props) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{instructor.name} 강사</CardTitle>
            <CardDescription>총 수업시간: {instructor.totalHours}시간</CardDescription>
          </div>
          <Button
            variant={showDetail ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowDetail(!showDetail)}
          >
            {showDetail ? '요약 보기' : '상세 조회'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allMonths.map((monthKey) => {
            const md = instructor.monthly[monthKey]
            if (!md) return null
            const monthNum = parseInt(monthKey.split('-')[1])

            return (
              <div key={monthKey}>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span>{monthNum}월</span>
                  <span className="text-muted-foreground font-normal">({md.total}시간)</span>
                </h4>

                {showDetail ? (
                  // ── 상세 조회: 과정별 날짜·요일·수업시간 ─────────────
                  <div className="space-y-2">
                    {md.courses.map((c, i) => (
                      <div key={i} className="rounded-md border overflow-hidden">
                        {/* 과정 헤더 */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b flex-wrap">
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">{c.name}</span>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {TYPE_LABEL[c.type] || c.type}
                          </Badge>
                          <span className="text-xs text-gray-500 shrink-0">{c.roomNumber}호</span>
                          <span className="text-xs font-semibold text-gray-700 shrink-0">
                            {c.days}일 · {c.hours}h
                          </span>
                        </div>
                        {/* 날짜별 수업 목록 */}
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/50">
                              <TableHead className="py-1.5 text-xs h-auto">날짜</TableHead>
                              <TableHead className="py-1.5 text-xs h-auto w-14 text-center">요일</TableHead>
                              <TableHead className="py-1.5 text-xs h-auto text-right">수업시간</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...c.sessions]
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((s, j) => {
                                const d = new Date(s.date + 'T00:00:00')
                                const isSat = s.dayOfWeek === '토'
                                const isSun = s.dayOfWeek === '일'
                                return (
                                  <TableRow key={j}>
                                    <TableCell className="py-1.5 text-xs">
                                      {monthNum}월 {d.getDate()}일
                                    </TableCell>
                                    <TableCell className="py-1.5 text-xs text-center">
                                      <span className={
                                        isSat ? 'font-semibold text-blue-600' :
                                        isSun ? 'font-semibold text-red-500' :
                                        'text-gray-700'
                                      }>
                                        {s.dayOfWeek}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-1.5 text-xs text-right font-medium">
                                      {s.hours}h
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                ) : (
                  // ── 요약 보기: 기존 레이아웃 ──────────────────────────
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>과정명</TableHead>
                          <TableHead>구분</TableHead>
                          <TableHead>강의실</TableHead>
                          <TableHead className="text-right">수업일수</TableHead>
                          <TableHead className="text-right">소계</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {md.courses.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{c.name}</TableCell>
                            <TableCell className="text-sm">{TYPE_LABEL[c.type] || c.type}</TableCell>
                            <TableCell className="text-sm">{c.roomNumber}호</TableCell>
                            <TableCell className="text-right text-sm">{c.days}일</TableCell>
                            <TableCell className="text-right text-sm font-medium">{c.hours}h</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
