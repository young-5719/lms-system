'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface CourseSummary {
  id: string
  fileName: string
  subject: string
  categoryName: string
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
}

function getLocalDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return getLocalDateStr(d)
}

function dDayLabel(dateStr: string, today: string): string {
  const diff = Math.round(
    (new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
  )
  if (diff === 0) return '오늘'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

export default function CourseSummary() {
  const [summaries, setSummaries] = useState<CourseSummary[] | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lms-course-summaries')
      setSummaries(stored ? JSON.parse(stored) : [])
    } catch {
      setSummaries([])
    }
  }, [])

  // 아직 로드 전 (hydration 방지)
  if (summaries === null) return null

  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-slate-500 font-medium">훈련 주간 달력에서 엑셀 파일을 업로드하면</p>
        <p className="text-slate-400 text-sm mt-1">개강·종강 현황이 여기에 자동으로 표시됩니다</p>
        <Link href="/training-calendar" className="inline-block mt-3 text-sm text-blue-600 hover:underline font-semibold">
          → 훈련 주간 달력으로 이동
        </Link>
      </div>
    )
  }

  const today = getLocalDateStr()
  const in5 = addDays(today, 5)
  const in3 = addDays(today, 3)
  const tomorrow = addDays(today, 1)

  const todayOpening = summaries.filter(s => s.startDate === today)
  const todayClosing = summaries.filter(s => s.endDate === today)
  const openingSoon = summaries
    .filter(s => s.startDate >= tomorrow && s.startDate <= in5)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const closingSoon = summaries
    .filter(s => s.endDate >= tomorrow && s.endDate <= in3)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))

  const hasNothing =
    todayOpening.length === 0 && todayClosing.length === 0 &&
    openingSoon.length === 0 && closingSoon.length === 0

  return (
    <div className="space-y-4">

      {/* 오늘 개강 배너 */}
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
              <div key={c.id} className="bg-white rounded-lg border border-emerald-200 px-4 py-3">
                <p className="font-semibold text-sm leading-snug">{c.subject || c.fileName.replace(/\.(xlsx|xls)$/i, '')}</p>
                <div className="flex gap-2 mt-1">
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                    {c.categoryName}
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{c.startDate} ~ {c.endDate}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 오늘 종강 배너 */}
      {todayClosing.length > 0 && (
        <div className="rounded-xl border-2 border-rose-400 bg-rose-50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🏁</span>
            <div>
              <p className="text-xl font-bold text-rose-800">오늘 종강</p>
              <p className="text-sm text-rose-600">{todayClosing.length}개 과정이 오늘 종강합니다</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayClosing.map(c => (
              <div key={c.id} className="bg-white rounded-lg border border-rose-200 px-4 py-3">
                <p className="font-semibold text-sm leading-snug">{c.subject || c.fileName.replace(/\.(xlsx|xls)$/i, '')}</p>
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px] mt-1">
                  {c.categoryName}
                </Badge>
                <p className="text-[11px] text-gray-400 mt-1">{c.startDate} ~ {c.endDate}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 개강 예정 / 종강 임박 */}
      {(openingSoon.length > 0 || closingSoon.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">

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
                <div key={c.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded px-2 py-1 whitespace-nowrap shrink-0">
                    {dDayLabel(c.startDate, today)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{c.subject || c.fileName.replace(/\.(xlsx|xls)$/i, '')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.startDate} · {c.categoryName}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

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
              ) : closingSoon.map(c => (
                <div key={c.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${c.endDate === today ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-100'}`}>
                  <span className={`text-xs font-bold rounded px-2 py-1 whitespace-nowrap shrink-0 ${c.endDate === today ? 'bg-red-200 text-red-700' : 'bg-orange-100 text-orange-600'}`}>
                    {c.endDate === today ? '오늘종강' : dDayLabel(c.endDate, today)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{c.subject || c.fileName.replace(/\.(xlsx|xls)$/i, '')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">종강 {c.endDate} · {c.categoryName}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      )}

      {/* 임박 일정 없을 때 */}
      {hasNothing && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
          현재 개강·종강 임박 과정이 없습니다
          <span className="text-xs block mt-1">업로드된 {summaries.length}개 과정 기준</span>
        </div>
      )}

    </div>
  )
}
