'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Clock, User, Download, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Types (mirrors training-calendar localStorage structure) ─────────────────

interface RawSession {
  start: string
  end: string
  room: string
  courseName?: string
  instructor?: string
}

interface RawDayData {
  minStart: string
  maxEnd: string
  lunchStart: string
  lunchEnd: string
  subjects: string[]
  ncsUnits: string[]
  rooms: string[]
  instructors: string[]
  sessions: RawSession[]
  isDiscretionary: boolean
}

interface RawCourse {
  id: string
  fileName: string
  data: Record<string, RawDayData>
  weeks: string[][]
  alerts: Record<string, string[]>
}

interface RawCategory {
  id: string
  name: string
  courses: RawCourse[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMins(t: string): number {
  const parts = (t || '00:00').split(':')
  return parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0')
}

function calcHours(start: string, end: string): number {
  return parseFloat((Math.max(0, toMins(end) - toMins(start)) / 60).toFixed(2))
}

function parseCourseSubject(fileName: string): string {
  const name = fileName.replace(/\.(xlsx|xls)$/i, '')
  const withoutDate = name.replace(/^\d{8}_/, '')
  const lastIdx = withoutDate.lastIndexOf('_')
  return lastIdx === -1 ? withoutDate : withoutDate.substring(0, lastIdx)
}

function getCatType(catName: string): string {
  if (catName.includes('실업자') || catName.includes('국기') || catName.includes('내일배움')) return '실업자'
  if (catName.includes('재직자') || catName.includes('근로자')) return '재직자'
  return catName || '일반'
}

function fmtHours(h: number): string {
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function getLocalDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDaysOfWeek(dates: string[]): string {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayNums = [...new Set(dates.map(d => new Date(d).getDay()))].sort((a, b) => a - b)
  if (!dayNums.length) return '-'
  if (JSON.stringify(dayNums) === JSON.stringify([1, 2, 3, 4, 5])) return '월~금'
  const isConsec = dayNums.every((n, i) => i === 0 || n === dayNums[i - 1] + 1)
  if (isConsec && dayNums.length >= 3) return `${dayNames[dayNums[0]]}~${dayNames[dayNums[dayNums.length - 1]]}`
  return dayNums.map(n => dayNames[n]).join('')
}

function fmtKRW(amount: number): string {
  if (amount === 0) return '-'
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원'
}

function cardId(name: string): string {
  return `instructor-card-${name.replace(/\s+/g, '-')}`
}

// ─── Calculation ──────────────────────────────────────────────────────────────

interface SessionRecord {
  date: string
  catType: string
  courseName: string
  subject: string
  catRawName: string
  start: string
  end: string
  room: string
  effectiveHours: number
}

interface GroupedRow {
  catType: string
  courseName: string
  daysOfWeek: string
  rooms: string[]
  firstDate: string
  lastDate: string
  overallTimeRange: string
  dailyHours: number
  totalHours: number
  dates: string[]
}

interface InstructorData {
  name: string
  rows: GroupedRow[]
  totalHours: number
  totalDays: number
}

function processData(categories: RawCategory[]): {
  byInstructor: Record<string, Record<string, SessionRecord[]>>
  availableMonths: string[]
} {
  const byInstructor: Record<string, Record<string, SessionRecord[]>> = {}
  const monthSet = new Set<string>()

  categories.forEach(cat => {
    const catType = getCatType(cat.name)
    cat.courses.forEach(course => {
      const subject = parseCourseSubject(course.fileName)
      Object.entries(course.data).forEach(([date, dayData]) => {
        const month = date.substring(0, 7)
        monthSet.add(month)
        dayData.sessions.forEach(session => {
          if (!session.instructor) return
          if (session.courseName?.includes('점심')) return
          session.instructor.split(/[,/]/).map(s => s.trim()).filter(Boolean).forEach(instructor => {
            if (!byInstructor[instructor]) byInstructor[instructor] = {}
            if (!byInstructor[instructor][month]) byInstructor[instructor][month] = []
            byInstructor[instructor][month].push({
              date,
              catType,
              catRawName: cat.name,
              courseName: subject,
              subject,
              start: session.start,
              end: session.end,
              room: session.room ?? '',
              effectiveHours: calcHours(session.start, session.end),
            })
          })
        })
      })
    })
  })

  const availableMonths = Array.from(monthSet).sort()
  return { byInstructor, availableMonths }
}

function buildInstructorData(sessions: SessionRecord[]): GroupedRow[] {
  const map: Record<string, {
    catType: string
    courseName: string
    dates: Set<string>
    rooms: Set<string>
    totalHours: number
    minStart: string
    maxEnd: string
  }> = {}

  sessions.forEach(s => {
    const key = `${s.catType}||${s.courseName}`
    if (!map[key]) {
      map[key] = {
        catType: s.catType,
        courseName: s.courseName,
        dates: new Set(),
        rooms: new Set(),
        totalHours: 0,
        minStart: s.start,
        maxEnd: s.end,
      }
    }
    map[key].dates.add(s.date)
    if (s.room) map[key].rooms.add(s.room)
    map[key].totalHours += s.effectiveHours
    if (toMins(s.start) < toMins(map[key].minStart)) map[key].minStart = s.start
    if (toMins(s.end) > toMins(map[key].maxEnd)) map[key].maxEnd = s.end
  })

  return Object.values(map)
    .sort((a, b) => a.catType.localeCompare(b.catType) || a.courseName.localeCompare(b.courseName))
    .map(g => {
      const sortedDates = Array.from(g.dates).sort()
      const totalHours = parseFloat(g.totalHours.toFixed(2))
      const dailyHours = sortedDates.length > 0
        ? parseFloat((totalHours / sortedDates.length).toFixed(2))
        : 0
      return {
        catType: g.catType,
        courseName: g.courseName,
        daysOfWeek: formatDaysOfWeek(sortedDates),
        rooms: Array.from(g.rooms).sort(),
        firstDate: sortedDates[0],
        lastDate: sortedDates[sortedDates.length - 1],
        overallTimeRange: `${g.minStart} ~ ${g.maxEnd}`,
        dailyHours,
        totalHours,
        dates: sortedDates,
      }
    })
}

// ─── Category badge color ─────────────────────────────────────────────────────

function catColor(catType: string): string {
  if (catType === '실업자') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (catType === '재직자') return 'bg-blue-100 text-blue-800 border-blue-300'
  return 'bg-slate-100 text-slate-700 border-slate-300'
}

// ─── Component ────────────────────────────────────────────────────────────────

const RATES_KEY = 'lms-instructor-rates'

export default function InstructorHoursPage() {
  const [categories, setCategories] = useState<RawCategory[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)
  const [rates, setRates] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lms-training-data')
      if (raw) {
        const parsed = JSON.parse(raw)
        setCategories(parsed.categories ?? [])
      }
    } catch { /* no-op */ }
    try {
      const savedRates = localStorage.getItem(RATES_KEY)
      if (savedRates) setRates(JSON.parse(savedRates))
    } catch { /* no-op */ }
    setIsInitialized(true)
  }, [])

  const updateRate = (key: string, value: string) => {
    setRates(prev => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem(RATES_KEY, JSON.stringify(next)) } catch { /* no-op */ }
      return next
    })
  }

  const { byInstructor, availableMonths } = useMemo(
    () => processData(categories),
    [categories],
  )

  const validMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : availableMonths[availableMonths.length - 1] ?? selectedMonth

  const instructors: InstructorData[] = useMemo(() => {
    return Object.entries(byInstructor)
      .map(([name, monthMap]) => {
        const sessions = monthMap[validMonth] ?? []
        const rows = buildInstructorData(sessions)
        const totalHours = parseFloat(rows.reduce((s, r) => s + r.totalHours, 0).toFixed(2))
        const totalDays = rows.reduce((s, r) => s + r.dates.length, 0)
        return { name, rows, totalHours, totalDays }
      })
      .filter(d => d.rows.length > 0)
      .sort((a, b) => b.totalHours - a.totalHours)
  }, [byInstructor, validMonth])

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const scrollToInstructor = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.add(name)
      return next
    })
    setTimeout(() => {
      document.getElementById(cardId(name))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // CSV export
  const handleExport = () => {
    const [y, m] = validMonth.split('-')
    const header = ['강사명', '구분', '과정명', '요일', '강의실', '시작일', '종료일', '수업시간', '시간/일(h)', '총시간(h)', '일수', '책정 강사료', '계약금액']
    const rows: string[][] = []
    instructors.forEach(inst => {
      inst.rows.forEach((row, i) => {
        const rateKey = `${inst.name}__${row.catType}__${row.courseName}`
        const rateVal = rates[rateKey] ?? ''
        const rateNum = parseFloat(rateVal) || 0
        const contractAmt = rateNum * row.totalHours
        rows.push([
          i === 0 ? inst.name : '',
          row.catType,
          row.courseName,
          row.daysOfWeek,
          row.rooms.join(', '),
          row.firstDate,
          row.lastDate,
          row.overallTimeRange,
          String(row.dailyHours),
          String(row.totalHours),
          String(row.dates.length),
          rateVal ? rateVal + '원/h' : '',
          contractAmt > 0 ? String(Math.round(contractAmt)) : '',
        ])
      })
      const totalContract = inst.rows.reduce((sum, row) => {
        const rateKey = `${inst.name}__${row.catType}__${row.courseName}`
        const rateNum = parseFloat(rates[rateKey] ?? '') || 0
        return sum + rateNum * row.totalHours
      }, 0)
      rows.push(['', '', '', '', '', '', '', '합계', '', String(inst.totalHours), String(inst.totalDays), '', totalContract > 0 ? String(Math.round(totalContract)) : ''])
      rows.push([])
    })
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `강사_월별_수업시간_${y}년_${m}월.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [displayY, displayM] = validMonth.split('-')

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-[1300px] mx-auto space-y-6">

        {/* 헤더 */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <User className="w-7 h-7 text-blue-600" />
              강사 월별 수업시간
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              훈련 주간 달력 업로드 데이터 기준 · 점심시간 및 타 강사 수업시간 자동 제외
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={instructors.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> CSV 다운로드
          </button>
        </div>

        {/* 월 선택 탭 */}
        {availableMonths.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2">
            {availableMonths.map(m => {
              const [y, mo] = m.split('-')
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={[
                    'px-4 py-2 rounded-xl text-sm font-bold transition-all',
                    validMonth === m
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {y}년 {parseInt(mo)}월
                </button>
              )
            })}
          </div>
        ) : isInitialized ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold">업로드된 데이터가 없습니다</p>
            <p className="text-sm mt-1">훈련 주간 달력에서 엑셀 파일을 먼저 업로드해 주세요</p>
          </div>
        ) : null}

        {/* 강사별 요약 + 상세 */}
        {isInitialized && availableMonths.length > 0 && (
          <>
            {/* 전체 요약 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">
                {displayY}년 {parseInt(displayM)}월 강사 요약
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 font-semibold text-slate-500 pr-6">강사명</th>
                      <th className="text-right pb-2 font-semibold text-slate-500 pr-6">총 수업시간</th>
                      <th className="text-right pb-2 font-semibold text-slate-500 pr-6">수업 일수</th>
                      <th className="text-right pb-2 font-semibold text-slate-500">과정 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.map(inst => (
                      <tr
                        key={inst.name}
                        className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td
                          className="py-2.5 pr-6 font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5"
                          onClick={() => scrollToInstructor(inst.name)}
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="underline underline-offset-2 decoration-dotted">{inst.name}</span>
                        </td>
                        <td className="py-2.5 pr-6 text-right font-black text-blue-700">
                          {fmtHours(inst.totalHours)}
                        </td>
                        <td className="py-2.5 pr-6 text-right text-slate-600">{inst.totalDays}일</td>
                        <td className="py-2.5 text-right text-slate-400">{inst.rows.length}개</td>
                      </tr>
                    ))}
                    {instructors.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          해당 월에 수업 데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 강사별 상세 카드 */}
            {instructors.map(inst => {
              const isOpen = expanded.has(inst.name)
              const totalContract = inst.rows.reduce((sum, row) => {
                const rateKey = `${inst.name}__${row.catType}__${row.courseName}`
                const rateNum = parseFloat(rates[rateKey] ?? '') || 0
                return sum + rateNum * row.totalHours
              }, 0)
              return (
                <div
                  key={inst.name}
                  id={cardId(inst.name)}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-6"
                >
                  {/* 강사 헤더 */}
                  <button
                    onClick={() => toggleExpand(inst.name)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-900 text-[15px]">{inst.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {displayY}년 {parseInt(displayM)}월 · {inst.totalDays}일 수업
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-black text-blue-700 text-lg">{fmtHours(inst.totalHours)}</p>
                        <p className="text-[11px] text-slate-400">총 수업시간</p>
                      </div>
                      {isOpen
                        ? <ChevronUp className="w-5 h-5 text-slate-400" />
                        : <ChevronDown className="w-5 h-5 text-slate-400" />
                      }
                    </div>
                  </button>

                  {/* 상세 테이블 */}
                  {isOpen && (
                    <div className="border-t border-slate-100">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[1100px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 w-20">구분</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">과정명</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 w-16">요일</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 w-24">강의실</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 w-24">시작일</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 w-24">종료일</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 w-36">책정 강사료</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 w-32">수업시간</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 w-20">시간/일</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 w-20">총시간</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 w-16">일수</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 w-28">계약금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inst.rows.map((row, i) => {
                              const rateKey = `${inst.name}__${row.catType}__${row.courseName}`
                              const rateVal = rates[rateKey] ?? ''
                              const rateNum = parseFloat(rateVal) || 0
                              const contractAmt = rateNum * row.totalHours
                              return (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                  <td className="px-3 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catColor(row.catType)}`}>
                                      {row.catType}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-slate-800 font-medium leading-snug">
                                    {row.courseName}
                                  </td>
                                  <td className="px-3 py-3 text-center text-xs font-medium text-slate-600">
                                    {row.daysOfWeek}
                                  </td>
                                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                                    {row.rooms.length > 0 ? row.rooms.join(', ') : '-'}
                                  </td>
                                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                                    {row.firstDate}
                                  </td>
                                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                                    {row.lastDate}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={rateVal}
                                        onChange={e => updateRate(rateKey, e.target.value)}
                                        placeholder="원/h"
                                        className="w-full text-right text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-slate-600 text-xs font-mono">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {row.overallTimeRange}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right text-xs text-slate-600">
                                    {fmtHours(row.dailyHours)}
                                  </td>
                                  <td className="px-3 py-3 text-right font-black text-blue-700">
                                    {fmtHours(row.totalHours)}
                                  </td>
                                  <td className="px-3 py-3 text-right text-slate-600 font-medium">
                                    {row.dates.length}일
                                  </td>
                                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-700">
                                    {fmtKRW(contractAmt)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900 text-white">
                              <td colSpan={8} className="px-3 py-3 text-sm font-bold">합계</td>
                              <td className="px-3 py-3 text-right text-sm font-bold text-slate-300">-</td>
                              <td className="px-3 py-3 text-right font-black text-blue-300">
                                {fmtHours(inst.totalHours)}
                              </td>
                              <td className="px-3 py-3 text-right font-bold">{inst.totalDays}일</td>
                              <td className="px-3 py-3 text-right font-bold text-amber-300">
                                {fmtKRW(totalContract)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
