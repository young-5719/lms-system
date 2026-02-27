'use client'

import React, { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Calendar, Upload, Clock, User, MapPin, BookOpen,
  FileText, Bell, Table2, X, LayoutGrid, ChevronDown, FolderOpen,
  ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  start: string
  end: string
  room: string
  courseName?: string
  instructor?: string
}

interface DayData {
  minStart: string
  maxEnd: string
  lunchStart: string
  lunchEnd: string
  subjects: Set<string>
  ncsUnits: Set<string>
  rooms: Set<string>
  instructors: Set<string>
  sessions: Session[]
  isDiscretionary: boolean
}

type DataMap = Record<string, DayData>
type AlertsMap = Record<string, string[]>

interface CourseEntry {
  id: string
  fileName: string
  data: DataMap
  weeks: Date[][]
  alerts: AlertsMap
}

interface Category {
  id: string
  name: string
  courses: CourseEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  { label: '09:00~09:30', start: '09:00', end: '09:30' },
  { label: '09:30~10:00', start: '09:30', end: '10:00' },
  { label: '10:00~10:30', start: '10:00', end: '10:30' },
  { label: '10:30~11:00', start: '10:30', end: '11:00' },
  { label: '11:00~11:30', start: '11:00', end: '11:30' },
  { label: '11:30~12:00', start: '11:30', end: '12:00' },
  { label: '12:00~12:30', start: '12:00', end: '12:30' },
  { label: '12:30~13:00', start: '12:30', end: '13:00' },
  { label: '13:00~13:30', start: '13:00', end: '13:30' },
  { label: '13:30~14:00', start: '13:30', end: '14:00' },
  { label: '14:00~14:30', start: '14:00', end: '14:30' },
  { label: '14:30~15:00', start: '14:30', end: '15:00' },
  { label: '15:00~15:30', start: '15:00', end: '15:30' },
  { label: '15:30~16:00', start: '15:30', end: '16:00' },
  { label: '16:00~16:30', start: '16:00', end: '16:30' },
  { label: '16:30~17:00', start: '16:30', end: '17:00' },
  { label: '17:00~17:30', start: '17:00', end: '17:30' },
  { label: '17:30~18:00', start: '17:30', end: '18:00' },
  { label: '18:00~18:30', start: '18:00', end: '18:30' },
  { label: '18:30~19:00', start: '18:30', end: '19:00' },
  { label: '19:00~19:30', start: '19:00', end: '19:30' },
  { label: '19:30~20:00', start: '19:30', end: '20:00' },
  { label: '20:00~20:30', start: '20:00', end: '20:30' },
  { label: '20:30~21:00', start: '20:30', end: '21:00' },
  { label: '21:00~21:30', start: '21:00', end: '21:30' },
  { label: '21:30~22:00', start: '21:30', end: '22:00' },
]

function getTimeColor(start: string): { bg: string; text: string; border: string } {
  const hour = parseInt(start.split(':')[0])
  if (hour < 19) return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' }
  return { bg: 'bg-slate-200', text: 'text-slate-600', border: 'border-slate-300' }
}

// 기본 강의장 목록 (601호~610호)
const DEFAULT_ROOMS = ['601호', '602호', '603호', '604호', '605호', '606호', '607호', '608호', '609호', '610호']

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// ─── Subject color palette ────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-900',    border: 'border-blue-400'    },
  { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-400' },
  { bg: 'bg-violet-100',  text: 'text-violet-900',  border: 'border-violet-400'  },
  { bg: 'bg-amber-100',   text: 'text-amber-900',   border: 'border-amber-400'   },
  { bg: 'bg-rose-100',    text: 'text-rose-900',    border: 'border-rose-400'    },
  { bg: 'bg-cyan-100',    text: 'text-cyan-900',    border: 'border-cyan-400'    },
  { bg: 'bg-orange-100',  text: 'text-orange-900',  border: 'border-orange-400'  },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-900', border: 'border-fuchsia-400' },
  { bg: 'bg-lime-100',    text: 'text-lime-900',    border: 'border-lime-400'    },
  { bg: 'bg-teal-100',    text: 'text-teal-900',    border: 'border-teal-400'    },
]

function getSubjectColor(subject: string) {
  let hash = 0
  const s = String(subject || '-')
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length]
}

// Parse "20251128_(멀티미디어)디지털광고제작_김용진" → { subject, instructor }
function parseCourseFileName(fileName: string): { subject: string; instructor: string } {
  const name = fileName.replace(/\.(xlsx|xls)$/i, '')
  const withoutDate = name.replace(/^\d{8}_/, '')
  const lastIdx = withoutDate.lastIndexOf('_')
  if (lastIdx === -1) return { subject: withoutDate, instructor: '' }
  return {
    subject: withoutDate.substring(0, lastIdx),
    instructor: withoutDate.substring(lastIdx + 1),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const getInstructorColor = (name: string): string => {
  const colors = [
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-rose-100 text-rose-700 border-rose-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200',
    'bg-orange-100 text-orange-700 border-orange-200',
    'bg-lime-100 text-lime-700 border-lime-200',
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'bg-sky-100 text-sky-700 border-sky-200',
  ]
  let hash = 0
  const strName = String(name || '미지정')
  for (let i = 0; i < strName.length; i++) {
    hash = strName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const maskName = (n: string | undefined): string => {
  if (!n) return '-'
  const str = String(n).trim()
  if (str.length <= 1) return str
  if (str.length === 2) return str[0] + '*'
  return str[0] + '*' + str.substring(2)
}

const formatRoom = (r: string | undefined): string => {
  if (!r) return '-'
  const str = String(r).trim()
  const match = str.match(/\d+호/)
  return match ? match[0] : str
}

const formatDate = (val: number | string): string => {
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000)
    return getLocalDateString(date)
  }
  const s = String(val).replace(/[^0-9]/g, '')
  if (s.length === 8)
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`
  return String(val).replace(/\./g, '-')
}

const formatExcelTime = (val: number | string | undefined): string => {
  if (typeof val === 'number') {
    const totalSeconds = Math.round(val * 86400)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
  return String(val || '').trim()
}

// ─── Month Calendar Helpers ───────────────────────────────────────────────────

interface MonthCalendar {
  key: string              // "YYYY-MM" — used as expand/collapse key
  year: number
  month: number            // 0-indexed
  calendarRows: (Date | null)[][]
}

function groupWeeksIntoMonths(weeks: Date[][]): MonthCalendar[] {
  if (weeks.length === 0) return []
  const allDays = weeks.flat()
  const minDate = allDays[0]
  const maxDate = allDays[allDays.length - 1]
  const months: MonthCalendar[] = []
  let y = minDate.getFullYear()
  let m = minDate.getMonth()
  while (y < maxDate.getFullYear() || (y === maxDate.getFullYear() && m <= maxDate.getMonth())) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const calendarRows: (Date | null)[][] = []
    const firstOfMonth = new Date(y, m, 1)
    const lastOfMonth = new Date(y, m + 1, 0)
    const day = new Date(firstOfMonth)
    day.setDate(1 - firstOfMonth.getDay())
    while (true) {
      if (day.getDay() === 0) calendarRows.push([])
      const inMonth = day.getMonth() === m && day.getFullYear() === y
      calendarRows[calendarRows.length - 1].push(inMonth ? new Date(day) : null)
      day.setDate(day.getDate() + 1)
      if (day > lastOfMonth && day.getDay() === 0) break
    }
    months.push({ key, year: y, month: m, calendarRows })
    m++
    if (m > 11) { m = 0; y++ }
  }
  return months
}

const isMonthPast = (year: number, month: number): boolean => {
  const today = new Date()
  return year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth())
}

const isMonthCurrent = (year: number, month: number): boolean => {
  const today = new Date()
  return year === today.getFullYear() && month === today.getMonth()
}

// ─── Pure Data Processing ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processTrainingDataPure(rawData: Record<string, any>[]) {
  const grouped: DataMap = {}
  const subjectDates: Record<string, { start: string; end: string }> = {}
  const ncsDates: Record<string, { start: string; end: string }> = {}
  let globalMin = '9999-12-31'
  let globalMax = '0000-01-01'

  rawData.forEach((item) => {
    const dateKey = item['훈련일자'] || item['날짜'] || item['date'] || item['일자']
    if (!dateKey) return

    const dateStr = formatDate(dateKey)
    if (dateStr < globalMin) globalMin = dateStr
    if (dateStr > globalMax) globalMax = dateStr

    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        minStart: '23:59',
        maxEnd: '00:00',
        lunchStart: formatExcelTime(item['점심시작시간'] || '13:00'),
        lunchEnd: formatExcelTime(item['점심종료시간'] || '14:00'),
        subjects: new Set(),
        ncsUnits: new Set(),
        rooms: new Set(),
        instructors: new Set(),
        sessions: [],
        isDiscretionary: false,
      }
    }

    const dayData = grouped[dateStr]
    const currentStart = formatExcelTime(item['시작시간'] || '09:00')
    const currentEnd = formatExcelTime(item['종료시간'] || '18:00')

    if (currentStart < dayData.minStart) dayData.minStart = currentStart
    if (currentEnd > dayData.maxEnd) dayData.maxEnd = currentEnd

    const sub = item['교과목']?.toString().trim() || ''
    const ncs = item['NCS능력단위']?.toString().trim()

    if (sub) {
      dayData.subjects.add(sub)
      if (!subjectDates[sub]) subjectDates[sub] = { start: dateStr, end: dateStr }
      if (dateStr < subjectDates[sub].start) subjectDates[sub].start = dateStr
      if (dateStr > subjectDates[sub].end) subjectDates[sub].end = dateStr
      if (sub.includes('재량')) dayData.isDiscretionary = true
    }

    if (ncs) {
      dayData.ncsUnits.add(ncs)
      if (!ncsDates[ncs]) ncsDates[ncs] = { start: dateStr, end: dateStr }
      if (dateStr < ncsDates[ncs].start) ncsDates[ncs].start = dateStr
      if (dateStr > ncsDates[ncs].end) ncsDates[ncs].end = dateStr
      if (ncs.includes('재량')) dayData.isDiscretionary = true
    }

    const roomRaw =
      item['교육장소(강의실)'] || item['교육장소'] || item['강의장'] || item['강의실']
    const room = roomRaw ? formatRoom(roomRaw.toString()) : '-'
    if (room !== '-' && room !== '') dayData.rooms.add(room)

    const instRaw = item['훈련강사'] || item['강사']
    const instStr = instRaw ? instRaw.toString().trim() : ''

    dayData.sessions.push({ start: currentStart, end: currentEnd, room, courseName: sub, instructor: instStr })

    if (instStr) {
      instStr.split(/[,/]/).forEach((n: string) => dayData.instructors.add(n.trim()))
    }
  })

  const alerts: AlertsMap = {}
  const addAlert = (date: string, text: string) => {
    if (!alerts[date]) alerts[date] = []
    if (!alerts[date].includes(text)) alerts[date].push(text)
  }

  if (globalMin !== '9999-12-31') {
    addAlert(globalMin, '🚀 개강일')
    addAlert(globalMax, '🏁 종강일')
    Object.entries(subjectDates).forEach(([name, range]) => {
      addAlert(range.start, `📖 [시작] ${name}`)
      addAlert(range.end, `📘 [종료] ${name}`)
    })
    Object.entries(ncsDates).forEach(([name, range]) => {
      addAlert(range.start, `💡 [NCS 시작] ${name}`)
      addAlert(range.end, `✅ [NCS 종료] ${name}`)
    })
  }

  Object.entries(grouped).forEach(([date, day]) => {
    if (day.instructors.size > 1) addAlert(date, '👤 강사 변경')
  })

  return { grouped, globalMin, globalMax, alerts }
}

function generateWeekListPure(min: string, max: string): Date[][] {
  if (min === '9999-12-31') return []
  const startDate = new Date(min)
  const endDate = new Date(max)
  const firstSunday = new Date(startDate)
  firstSunday.setDate(startDate.getDate() - startDate.getDay())
  const weekList: Date[][] = []
  let currentDay = new Date(firstSunday)
  while (currentDay <= endDate || currentDay.getDay() !== 0) {
    if (currentDay.getDay() === 0) weekList.push([])
    weekList[weekList.length - 1].push(new Date(currentDay))
    currentDay.setDate(currentDay.getDate() + 1)
    if (currentDay > endDate && currentDay.getDay() === 0) break
  }
  return weekList
}

// ─── FileSystem API Helpers ───────────────────────────────────────────────────

function fileFromEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise(resolve => entry.file(resolve, () => resolve(null)))
}

function readDirectoryFiles(dirEntry: FileSystemDirectoryEntry): Promise<File[]> {
  return new Promise(resolve => {
    const reader = dirEntry.createReader()
    const files: File[] = []
    const readBatch = () => {
      reader.readEntries(async entries => {
        if (entries.length === 0) { resolve(files); return }
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await fileFromEntry(entry as FileSystemFileEntry)
            if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
              files.push(file)
            }
          }
        }
        readBatch()
      })
    }
    readBatch()
  })
}

// ─── Room Matrix Types ────────────────────────────────────────────────────────

interface MatrixCell {
  occupied: boolean
  subject?: string     // parsed from fileName (e.g. "(멀티미디어)디지털광고제작")
  fileName?: string    // full name without extension
  courseName?: string  // 교과목 from Excel column
  instructor?: string
}

interface CellRenderInfo {
  skip: boolean
  rowSpan: number
  occupied: boolean
  subject?: string
  fileName?: string
  courseName?: string  // 교과목 from Excel column
  instructor?: string
}

function computeCellGrid(
  rooms: string[],
  usedSlots: { start: string; end: string; label: string }[],
  matrix: Record<string, Record<string, MatrixCell>>
): Record<string, Record<string, CellRenderInfo>> {
  const grid: Record<string, Record<string, CellRenderInfo>> = {}

  for (const room of rooms) {
    grid[room] = {}
    let i = 0
    while (i < usedSlots.length) {
      const slot = usedSlots[i]
      const info = matrix[room]?.[slot.start]

      if (!info?.occupied) {
        grid[room][slot.start] = { skip: false, rowSpan: 1, occupied: false }
        i++
        continue
      }

      // Count consecutive identical sessions to merge
      let span = 1
      while (i + span < usedSlots.length) {
        const nextSlot = usedSlots[i + span]
        const nextInfo = matrix[room]?.[nextSlot.start]
        if (
          nextInfo?.occupied &&
          nextInfo.subject === info.subject &&
          nextInfo.fileName === info.fileName &&
          nextInfo.instructor === info.instructor
        ) {
          span++
        } else {
          break
        }
      }

      grid[room][slot.start] = {
        skip: false, rowSpan: span, occupied: true,
        subject: info.subject, instructor: info.instructor, fileName: info.fileName,
        courseName: info.courseName,
      }
      for (let j = 1; j < span; j++) {
        grid[room][usedSlots[i + j].start] = { skip: true, rowSpan: 1, occupied: true }
      }
      i += span
    }
  }

  return grid
}

// ─── localStorage persistence helpers ────────────────────────────────────────

type SerializedDayData = Omit<DayData, 'subjects' | 'ncsUnits' | 'rooms' | 'instructors'> & {
  subjects: string[]
  ncsUnits: string[]
  rooms: string[]
  instructors: string[]
}

interface SerializedCourseEntry {
  id: string
  fileName: string
  data: Record<string, SerializedDayData>
  weeks: string[][]
  alerts: AlertsMap
}

interface SerializedCategory {
  id: string
  name: string
  courses: SerializedCourseEntry[]
}

function serializeCategories(cats: Category[]): SerializedCategory[] {
  return cats.map(cat => ({
    id: cat.id,
    name: cat.name,
    courses: cat.courses.map(course => ({
      id: course.id,
      fileName: course.fileName,
      alerts: course.alerts,
      data: Object.fromEntries(
        Object.entries(course.data).map(([k, v]) => [k, {
          ...v,
          subjects: Array.from(v.subjects),
          ncsUnits: Array.from(v.ncsUnits),
          rooms: Array.from(v.rooms),
          instructors: Array.from(v.instructors),
        }])
      ),
      weeks: course.weeks.map(week =>
        week.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      ),
    })),
  }))
}

function deserializeCategories(data: SerializedCategory[]): Category[] {
  return data.map(cat => ({
    id: cat.id,
    name: cat.name,
    courses: cat.courses.map(course => ({
      id: course.id,
      fileName: course.fileName,
      alerts: course.alerts,
      data: Object.fromEntries(
        Object.entries(course.data).map(([k, v]) => [k, {
          ...v,
          subjects: new Set<string>(v.subjects),
          ncsUnits: new Set<string>(v.ncsUnits),
          rooms: new Set<string>(v.rooms),
          instructors: new Set<string>(v.instructors),
        }])
      ),
      weeks: course.weeks.map(week => week.map(s => new Date(s + 'T00:00:00'))),
    })),
  }))
}

// ─── Month grid builder (for any arbitrary month) ────────────────────────────

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const rows: (Date | null)[][] = []
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const day = new Date(firstOfMonth)
  day.setDate(1 - firstOfMonth.getDay())
  while (true) {
    if (day.getDay() === 0) rows.push([])
    const inMonth = day.getMonth() === month && day.getFullYear() === year
    rows[rows.length - 1].push(inMonth ? new Date(day) : null)
    day.setDate(day.getDate() + 1)
    if (day > lastOfMonth && day.getDay() === 0) break
  }
  return rows
}

// ─── Opening / closing summary helpers ───────────────────────────────────────

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return getLocalDateString(d)
}

function dDayStr(dateStr: string, today: string): string {
  const diff = Math.round(
    (new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
  )
  if (diff === 0) return '오늘'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

// 실업자 계열 카테고리 판별 (폴더명 기준)
function isUnemployedCat(catName: string): boolean {
  return catName.includes('실업자') || catName.includes('국기') || catName.includes('내일배움')
}

// ─── Course status helpers ────────────────────────────────────────────────────

function isCourseFinished(course: CourseEntry): boolean {
  const dates = Object.keys(course.data)
  if (dates.length === 0) return false
  const lastDate = [...dates].sort().at(-1)!
  const today = getLocalDateString(new Date())
  return lastDate < today
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainingCalendarPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentViewMonth, setCurrentViewMonth] = useState<{ year: number; month: number }>(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  const calendarRef = useRef<HTMLDivElement>(null)

  // ── Derived values ───────────────────────────────────────────────────────────
  const currentCategory =
    categories.find(c => c.id === activeCategory) ?? categories[0] ?? null

  const activeCourse =
    currentCategory?.courses.find(c => c.id === activeCourseId) ??
    currentCategory?.courses[0] ??
    null

  const allCourses = categories.flatMap(cat => cat.courses)

  // ── 초기 로드: localStorage → 상태 복원 ─────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lms-training-data')
      if (raw) {
        const parsed = JSON.parse(raw)
        const cats = deserializeCategories(parsed.categories ?? [])
        if (cats.length > 0) {
          setCategories(cats)
          setActiveCategory(parsed.activeCategory ?? null)
          setActiveCourseId(parsed.activeCourseId ?? null)
          if (Array.isArray(parsed.expandedMonths)) {
            setExpandedMonths(new Set(parsed.expandedMonths))
          }
        }
      }
    } catch { /* no-op */ }
    setIsInitialized(true)
  }, [])

  // ── 전체 상태 저장 (초기화 완료 후에만) ─────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) return
    try {
      localStorage.setItem('lms-training-data', JSON.stringify({
        categories: serializeCategories(categories),
        activeCategory,
        activeCourseId,
        expandedMonths: Array.from(expandedMonths),
      }))
    } catch { /* no-op */ }
  }, [categories, activeCategory, activeCourseId, expandedMonths, isInitialized])

  // ── localStorage 동기화 (대시보드 연동) ─────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) return
    const summaries = categories.flatMap(cat =>
      cat.courses.map(course => {
        const { subject } = parseCourseFileName(course.fileName)
        const dates = Object.keys(course.data).sort()
        return {
          id: course.id,
          fileName: course.fileName,
          subject,
          categoryName: cat.name,
          startDate: dates[0] ?? '',
          endDate: dates[dates.length - 1] ?? '',
        }
      })
    )
    try { localStorage.setItem('lms-course-summaries', JSON.stringify(summaries)) } catch { /* no-op */ }
  }, [categories, isInitialized])

  // ── Expanded months management ────────────────────────────────────────────────
  const initExpandedMonths = (courseId: string, weeks: Date[][]) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      groupWeeksIntoMonths(weeks).forEach(({ key, year, month }) => {
        // Expand current and future months; collapse past months
        if (!isMonthPast(year, month)) next.add(`${courseId}-${key}`)
      })
      return next
    })
  }

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── File processing ───────────────────────────────────────────────────────────
  const parseAndAddFile = (categoryName: string, file: File) => {
    const catId = `cat-${categoryName}`
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string
      const wb = XLSX.read(bstr, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonData = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
      const { grouped, globalMin, globalMax, alerts } = processTrainingDataPure(jsonData)
      const weeks = generateWeekListPure(globalMin, globalMax)
      const newCourseId = `course-${Date.now()}-${Math.random()}`
      const entry: CourseEntry = { id: newCourseId, fileName: file.name, data: grouped, weeks, alerts }

      setCategories(prev => {
        const catIdx = prev.findIndex(c => c.id === catId)
        if (catIdx >= 0) {
          const updated = [...prev]
          const existing = updated[catIdx]
          const courseIdx = existing.courses.findIndex(c => c.fileName === file.name)
          if (courseIdx >= 0) {
            // Replace existing course (same filename)
            const updatedCourses = [...existing.courses]
            const oldId = updatedCourses[courseIdx].id
            updatedCourses[courseIdx] = { ...entry, id: oldId }
            updated[catIdx] = { ...existing, courses: updatedCourses }
            initExpandedMonths(oldId, weeks)
          } else {
            // Add new course to existing category
            updated[catIdx] = { ...existing, courses: [...existing.courses, entry] }
            initExpandedMonths(newCourseId, weeks)
          }
          return updated
        } else {
          // Create new category
          initExpandedMonths(newCourseId, weeks)
          return [...prev, { id: catId, name: categoryName, courses: [entry] }]
        }
      })

      // Auto-select this category and course
      setActiveCategory(catId)
      setActiveCourseId(newCourseId)
    }
    reader.readAsBinaryString(file)
  }

  const processCategoryFiles = (categoryName: string, files: File[]) => {
    files
      .filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
      .forEach(f => parseAndAddFile(categoryName, f))
  }

  // ── Upload handlers ───────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) processCategoryFiles('기타', files)
    e.target.value = ''
  }

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const groups: Record<string, File[]> = {}
    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relPath = ((file as any).webkitRelativePath as string) || file.name
      const folder = relPath.split('/')[0] || '기타'
      if (!groups[folder]) groups[folder] = []
      groups[folder].push(file)
    }
    for (const [folderName, folderFiles] of Object.entries(groups)) {
      processCategoryFiles(folderName, folderFiles)
    }
    e.target.value = ''
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const items = Array.from(e.dataTransfer.items)
    const hasDir = items.some(item => item.webkitGetAsEntry()?.isDirectory)

    if (hasDir) {
      for (const item of items) {
        const entry = item.webkitGetAsEntry()
        if (!entry) continue
        if (entry.isDirectory) {
          const files = await readDirectoryFiles(entry as FileSystemDirectoryEntry)
          if (files.length > 0) processCategoryFiles(entry.name, files)
        } else if (entry.isFile) {
          const file = await fileFromEntry(entry as FileSystemFileEntry)
          if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            processCategoryFiles('기타', [file])
          }
        }
      }
    } else {
      const files = Array.from(e.dataTransfer.files).filter(
        f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
      )
      if (files.length === 0) {
        alert('엑셀 파일(.xlsx, .xls) 또는 폴더를 드래그하세요.')
        return
      }
      processCategoryFiles('기타', files)
    }
  }

  // ── Remove handlers ───────────────────────────────────────────────────────────
  const handleRemoveCategory = (catId: string) => {
    setCategories(prev => {
      const next = prev.filter(c => c.id !== catId)
      if (activeCategory === catId) {
        setActiveCategory(next[0]?.id ?? null)
        setActiveCourseId(null)
      }
      return next
    })
    setModalDate(null)
  }

  const handleRemoveCourse = (catId: string, courseId: string) => {
    setCategories(prev =>
      prev
        .map(cat => {
          if (cat.id !== catId) return cat
          const next = cat.courses.filter(c => c.id !== courseId)
          if (activeCourseId === courseId) setActiveCourseId(next[0]?.id ?? null)
          return { ...cat, courses: next }
        })
        .filter(cat => cat.courses.length > 0)
    )
    setModalDate(null)
  }

  // ── PDF download ──────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!activeCourse || !calendarRef.current) return
    setIsGenerating(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const opt = {
        margin: 5,
        filename: `훈련주간일정_${activeCourse.fileName.replace(/\.(xlsx|xls)$/i, '')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
        pagebreak: { mode: ['css', 'legacy'] },
      }
      await html2pdf().from(calendarRef.current).set(opt).save()
    } catch (err) {
      console.error('PDF 생성 실패:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Room matrix ───────────────────────────────────────────────────────────────
  const computeRoomMatrix = (dateStr: string) => {
    // Attach parsed subject + fileName to each session for display in modal
    const allSessions = allCourses.flatMap(c => {
      const { subject } = parseCourseFileName(c.fileName)
      const fullName = c.fileName.replace(/\.(xlsx|xls)$/i, '')
      return (c.data[dateStr]?.sessions ?? []).map(s => ({
        ...s,
        subject,
        fileName: fullName,
      }))
    })

    // Always show 601호~610호 as defaults, plus any extra rooms from sessions
    const sessionRooms = new Set(allSessions.map(s => s.room).filter(r => r && r !== '-'))
    const rooms = Array.from(new Set([...DEFAULT_ROOMS, ...sessionRooms]))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    const matrix: Record<string, Record<string, MatrixCell>> = {}
    for (const room of rooms) {
      matrix[room] = {}
      for (const slot of TIME_SLOTS) {
        const session = allSessions.find(
          s => s.room === room && s.start < slot.end && s.end > slot.start
        )
        matrix[room][slot.start] = session
          ? { occupied: true, subject: session.subject, courseName: session.courseName, instructor: session.instructor, fileName: session.fileName }
          : { occupied: false }
      }
    }

    const hasData = allSessions.length > 0
    const minTime = hasData
      ? allSessions.reduce((m, s) => (s.start < m ? s.start : m), '23:59')
      : '09:00'
    const maxTime = hasData
      ? allSessions.reduce((m, s) => (s.end > m ? s.end : m), '00:00')
      : '18:00'
    const usedSlots = TIME_SLOTS.filter(slot => slot.start >= minTime && slot.start < maxTime)

    return { rooms, matrix, usedSlots, hasData }
  }

  // ── Unified day cell — 특이사항 목록 표시 ───────────────────────────────────
  const renderUnifiedDay = (day: Date | null) => {
    if (!day) return <div className="bg-slate-50/30 border-r border-slate-200 min-h-[90px]" />

    const dateStr = getLocalDateString(day)
    const todayStr = getLocalDateString(new Date())
    const isToday = dateStr === todayStr
    const isSelected = modalDate === dateStr

    // 실업자 / 근로자 항목 분리
    const unemployedNotices: string[] = []
    const employedNotices: string[] = []

    categories.forEach(cat => {
      const target = isUnemployedCat(cat.name) ? unemployedNotices : employedNotices
      cat.courses.forEach(c => {
        const dayData = c.data[dateStr]
        if (!dayData) return
        const alerts = c.alerts[dateStr] ?? []
        alerts.forEach(a => target.push(a))
        if (dayData.isDiscretionary) target.push('재량교과')
      })
    })

    const hasData = categories.some(cat => cat.courses.some(c => c.data[dateStr]))
    const hasAnyNotice = unemployedNotices.length > 0 || employedNotices.length > 0

    return (
      <div
        onClick={() => hasData && setModalDate(dateStr)}
        className={[
          'p-1.5 flex flex-col min-h-[90px] border-r border-slate-200 last:border-r-0 transition-colors',
          !hasData
            ? 'bg-slate-50'
            : day.getDay() === 0
            ? 'bg-rose-50/20'
            : isToday
            ? 'bg-blue-50/40'
            : 'bg-white',
          hasData ? 'cursor-pointer hover:bg-blue-50/50' : '',
          isSelected ? 'ring-2 ring-inset ring-blue-500' : '',
        ].join(' ')}
      >
        {/* Date number */}
        <span
          className={[
            'text-sm font-black w-6 h-6 flex items-center justify-center rounded-md mb-1 shrink-0',
            isToday
              ? 'bg-blue-600 text-white'
              : day.getDay() === 0
              ? 'text-rose-500'
              : day.getDay() === 6
              ? 'text-blue-600'
              : 'text-slate-700',
            !hasData ? 'opacity-30' : '',
          ].join(' ')}
        >
          {day.getDate()}
        </span>

        {hasAnyNotice ? (
          <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
            {/* 실업자 특이사항 — 먼저, 보통 크기 */}
            {unemployedNotices.map((n, i) => (
              <span
                key={`u-${i}`}
                className="text-[10px] font-semibold text-slate-700 leading-tight truncate"
              >
                {n}
              </span>
            ))}
            {/* 근로자 특이사항 — 작게, 회색 */}
            {employedNotices.map((n, i) => (
              <span
                key={`e-${i}`}
                className="text-[9px] text-slate-400 leading-tight truncate"
              >
                {n}
              </span>
            ))}
          </div>
        ) : hasData ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[9px] text-slate-300 font-medium">수업</span>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    )
  }

  // ── Modal ─────────────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modalDate) return null
    const { rooms, matrix, usedSlots, hasData } = computeRoomMatrix(modalDate)
    const cellGrid = computeCellGrid(rooms, usedSlots, matrix)
    const dateObj = new Date(modalDate + 'T00:00:00')
    const [, mStr, dStr] = modalDate.split('-')
    const dayName = WEEKDAYS[dateObj.getDay()]

    // 과정별 세부 데이터 — 실업자 먼저
    const perCourseData = categories
      .flatMap(cat =>
        cat.courses
          .filter(c => c.data[modalDate])
          .map(c => {
            const dayData = c.data[modalDate]
            const { subject } = parseCourseFileName(c.fileName)
            const notices = [
              ...(c.alerts[modalDate] ?? []),
              ...(dayData.isDiscretionary ? ['재량교과'] : []),
            ]
            return {
              id: c.id,
              subject: subject || c.fileName.replace(/\.(xlsx|xls)$/i, ''),
              catName: cat.name,
              isUnemployed: isUnemployedCat(cat.name),
              timeRange: `${dayData.minStart} ~ ${dayData.maxEnd}`,
              subjects: Array.from(dayData.subjects),
              instructors: Array.from(dayData.instructors),
              notices,
            }
          })
      )
      .sort((a, b) => (b.isUnemployed ? 1 : 0) - (a.isUnemployed ? 1 : 0))

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3"
        onClick={() => setModalDate(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-[96vw] max-w-[1400px] max-h-[92vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white rounded-t-2xl flex-shrink-0">
            <h2 className="text-xl font-black flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-blue-400" />
              {parseInt(mStr)}월 {parseInt(dStr)}일 ({dayName}) 세부 일정
            </h2>
            <button
              onClick={() => setModalDate(null)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="overflow-auto flex-1 p-5 space-y-6">

            {/* ── 섹션 1: 과정별 세부 일정 ── */}
            {perCourseData.length > 0 ? (
              <section className="space-y-5">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> 과정별 세부 일정
                </h3>

                {/* 실업자 계열 */}
                {perCourseData.filter(e => e.isUnemployed).length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        실업자 계열
                      </span>
                      <div className="flex-1 border-t border-emerald-200" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {perCourseData.filter(e => e.isUnemployed).map(entry => {
                        const sc = getSubjectColor(entry.subject)
                        return (
                          <div
                            key={entry.id}
                            className={`rounded-xl border-2 p-4 flex flex-col gap-3 ${sc.border} bg-white`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`font-black text-[15px] leading-snug ${sc.text}`}>{entry.subject}</p>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>{entry.catName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-sm font-black text-slate-700">{entry.timeRange}</span>
                            </div>
                            {entry.subjects.length > 0 && (
                              <div className="space-y-1.5">
                                {entry.subjects.map((s, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${sc.text.replace('text-', 'bg-')}`} />
                                    <span className="text-sm text-slate-700 leading-snug">{s}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {entry.instructors.length > 0 && (
                              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-xs text-slate-500">{entry.instructors.map(maskName).join(' · ')}</span>
                              </div>
                            )}
                            {entry.notices.length > 0 && (
                              <div className="pt-2 border-t-2 border-red-100 space-y-1">
                                {entry.notices.map((n, i) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                    <span className="text-sm font-black text-red-600 leading-snug">{n}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 근로자 계열 */}
                {perCourseData.filter(e => !e.isUnemployed).length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                        근로자 계열
                      </span>
                      <div className="flex-1 border-t border-blue-200" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {perCourseData.filter(e => !e.isUnemployed).map(entry => {
                        const sc = getSubjectColor(entry.subject)
                        return (
                      <div
                        key={entry.id}
                        className={`rounded-xl border-2 p-4 flex flex-col gap-3 ${sc.border} bg-white`}
                      >
                        {/* 과정명 + 카테고리 */}
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-black text-[15px] leading-snug ${sc.text}`}>
                            {entry.subject}
                          </p>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                            {entry.catName}
                          </span>
                        </div>

                        {/* 시간대 */}
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-black text-slate-700">{entry.timeRange}</span>
                        </div>

                        {/* 교과목 목록 */}
                        {entry.subjects.length > 0 && (
                          <div className="space-y-1.5">
                            {entry.subjects.map((s, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${sc.text.replace('text-', 'bg-')}`} />
                                <span className="text-sm text-slate-700 leading-snug">{s}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 강사 */}
                        {entry.instructors.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-500">
                              {entry.instructors.map(maskName).join(' · ')}
                            </span>
                          </div>
                        )}

                        {/* 특이사항 — 빨간 볼드, 과정 카드 안에 통합 */}
                        {entry.notices.length > 0 && (
                          <div className="pt-2 border-t-2 border-red-100 space-y-1">
                            {entry.notices.map((n, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                <span className="text-sm font-black text-red-600 leading-snug">{n}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                    </div>
                  </div>
                )}

              </section>
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                해당 날짜에 등록된 수업이 없습니다
              </div>
            )}

            {/* ── 섹션 2: 강의장 시간표 ── */}
            {hasData && (
              <section>
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> 강의장 시간표
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-sm min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="p-2 border-b border-r text-xs font-semibold text-slate-500 w-[110px] bg-slate-50 whitespace-nowrap">
                          시간
                        </th>
                        {rooms.map(room => (
                          <th key={room} className="p-2 border-b border-r last:border-r-0 text-center text-xs font-bold text-slate-700 min-w-[100px] bg-slate-50">
                            {room}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usedSlots.map(slot => {
                        const tc = getTimeColor(slot.start)
                        return (
                          <tr key={slot.start}>
                            <td className={`p-2 border-b border-r text-xs font-medium whitespace-nowrap ${tc.bg} ${tc.text}`}>
                              {slot.label}
                            </td>
                            {rooms.map(room => {
                              const cell = cellGrid[room]?.[slot.start]
                              if (!cell || cell.skip) return null
                              if (!cell.occupied) {
                                return (
                                  <td key={room} className="p-2 border-b border-r last:border-r-0 text-center bg-white">
                                    <span className="text-slate-200 text-base font-light">-</span>
                                  </td>
                                )
                              }
                              const sc = getSubjectColor(cell.subject ?? '')
                              return (
                                <td
                                  key={room}
                                  rowSpan={cell.rowSpan}
                                  className={`p-2 border-b border-r last:border-r-0 ${sc.bg} ${sc.border} align-top`}
                                >
                                  <div className="space-y-0.5">
                                    <div className={`font-black text-[12px] leading-snug line-clamp-3 ${sc.text}`}>
                                      {cell.subject || '-'}
                                    </div>
                                    {cell.courseName && cell.courseName !== cell.subject && (
                                      <div className="text-[10px] text-slate-500 line-clamp-2">
                                        {cell.courseName}
                                      </div>
                                    )}
                                    {cell.instructor && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                        <span className="text-[10px] text-slate-500 truncate">
                                          {maskName(cell.instructor)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                {(() => {
                  const seen = new Set<string>()
                  const subjects: string[] = []
                  for (const room of rooms) {
                    for (const slot of usedSlots) {
                      const cell = cellGrid[room]?.[slot.start]
                      if (cell && !cell.skip && cell.occupied && cell.subject && !seen.has(cell.subject)) {
                        seen.add(cell.subject); subjects.push(cell.subject)
                      }
                    }
                  }
                  return subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                      {subjects.map(sub => {
                        const sc = getSubjectColor(sub)
                        return (
                          <span key={sub} className="flex items-center gap-1">
                            <span className={`w-3 h-3 rounded border inline-block ${sc.bg} ${sc.border}`} />
                            <span className="text-slate-700">{sub}</span>
                          </span>
                        )
                      })}
                    </div>
                  ) : null
                })()}
              </section>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────

  const hasCalendar = !!(activeCourse && activeCourse.weeks.length > 0)

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      <div
        className={`fixed inset-0 z-40 flex items-center justify-center bg-blue-600/20 backdrop-blur-sm transition-opacity ${
          isDragging ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 border-4 border-dashed border-blue-600">
          <Upload className="w-20 h-20 text-blue-600 animate-bounce" />
          <h2 className="text-3xl font-black text-blue-900">
            엑셀 파일 또는 폴더를 놓아주세요
          </h2>
        </div>
      </div>

      {/* 강의장 현황 모달 */}
      {renderModal()}

      <div className="max-w-[1400px] mx-auto p-4 md:p-8">
        {/* 헤더 */}
        <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Calendar className="w-10 h-10 text-blue-600" /> 훈련 주간 매니저
            </h1>
            <p className="text-slate-500 mt-1">
              엑셀 파일 또는 폴더를 업로드하면 월별 훈련 일정을 자동으로 생성합니다.
              {categories.length > 0 && (
                <span className="text-blue-600 ml-2 font-semibold">
                  수업 날짜 클릭 → 강의장 현황
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={!hasCalendar || isGenerating}
              className={`flex items-center gap-2 px-6 py-4 bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-lg disabled:opacity-50 ${
                isGenerating ? 'animate-pulse' : 'hover:bg-slate-900'
              }`}
            >
              <FileText className="w-5 h-5" />
              {isGenerating ? '생성 중...' : 'PDF 다운로드'}
            </button>
            {/* 폴더 업로드 */}
            <label className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold cursor-pointer hover:bg-indigo-700 transition-all shadow-lg">
              <FolderOpen className="w-5 h-5" /> 폴더 업로드
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFolderUpload}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ webkitdirectory: '', directory: '' } as any)}
              />
            </label>
            {/* 개별 파일 업로드 */}
            <label className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold cursor-pointer hover:bg-blue-700 transition-all shadow-lg">
              <Upload className="w-5 h-5" /> 파일 업로드
              <input
                type="file"
                accept=".xlsx,.xls"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </header>

        {/* 카테고리 & 과정 탭 */}
        {categories.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            {/* 카테고리 행 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 shrink-0 w-14">카테고리</span>
              {categories.map(cat => {
                const isActive =
                  cat.id === activeCategory ||
                  (!activeCategory && categories[0]?.id === cat.id)
                return (
                  <div
                    key={cat.id}
                    className={[
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 cursor-pointer',
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600',
                    ].join(' ')}
                    onClick={() => {
                      setActiveCategory(cat.id)
                      setActiveCourseId(null)
                    }}
                  >
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="max-w-[160px] truncate">{cat.name}</span>
                    <span className={`text-xs font-normal ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                      ({cat.courses.length})
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleRemoveCategory(cat.id) }}
                      className={`ml-0.5 p-0.5 rounded transition-colors ${
                        isActive ? 'text-indigo-200 hover:text-white' : 'text-slate-300 hover:text-red-500'
                      }`}
                      title="카테고리 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 과정 행 (선택된 카테고리 내) */}
            {currentCategory && currentCategory.courses.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pl-2 border-l-4 border-indigo-200">
                <span className="text-xs font-bold text-slate-400 shrink-0 w-14">과정</span>
                {[...currentCategory.courses]
                  .sort((a, b) => {
                    const af = isCourseFinished(a), bf = isCourseFinished(b)
                    if (af === bf) return 0
                    return af ? 1 : -1
                  })
                  .map(course => {
                    const isActive =
                      course.id === activeCourseId ||
                      (!activeCourseId && currentCategory.courses[0]?.id === course.id)
                    const finished = isCourseFinished(course)
                    return (
                      <div
                        key={course.id}
                        className={[
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 cursor-pointer',
                          finished ? 'opacity-50' : '',
                          isActive
                            ? finished
                              ? 'bg-slate-500 text-white border-slate-500 shadow-sm'
                              : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : finished
                              ? 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600',
                        ].join(' ')}
                        onClick={() => setActiveCourseId(course.id)}
                      >
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="max-w-[180px] truncate">
                          {course.fileName.replace(/\.(xlsx|xls)$/i, '')}
                        </span>
                        {finished && (
                          <span className="text-[9px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                            종강
                          </span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handleRemoveCourse(currentCategory.id, course.id) }}
                          className={`ml-0.5 p-0.5 rounded transition-colors ${
                            isActive ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-red-500'
                          }`}
                          title="과정 삭제"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )
                  })}
              </div>
            )}

            <p className="text-xs text-slate-400 pl-2">
              강의장 현황은 모든 카테고리·과정 합산 · 수업 날짜 클릭 시 팝업
            </p>
          </div>
        )}

        {/* 개강·종강 현황 카드 */}
        {allCourses.length > 0 && (() => {
          const todayStr = getLocalDateString(new Date())
          const tomorrow = addDaysStr(todayStr, 1)
          const in5 = addDaysStr(todayStr, 5)
          const in3 = addDaysStr(todayStr, 3)

          const summaries = categories.flatMap(cat =>
            cat.courses.map(course => {
              const dates = Object.keys(course.data).sort()
              return {
                id: course.id,
                subject: parseCourseFileName(course.fileName).subject || course.fileName.replace(/\.(xlsx|xls)$/i, ''),
                categoryName: cat.name,
                startDate: dates[0] ?? '',
                endDate: dates[dates.length - 1] ?? '',
              }
            })
          )

          const todayOpening = summaries.filter(s => s.startDate === todayStr)
          const todayClosing = summaries.filter(s => s.endDate === todayStr)
          const openingSoon = summaries
            .filter(s => s.startDate >= tomorrow && s.startDate <= in5)
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
          const closingSoon = summaries
            .filter(s => s.endDate >= tomorrow && s.endDate <= in3)
            .sort((a, b) => a.endDate.localeCompare(b.endDate))

          const hasAnything =
            todayOpening.length > 0 || todayClosing.length > 0 ||
            openingSoon.length > 0 || closingSoon.length > 0

          if (!hasAnything) return null

          return (
            <div className="mb-4 space-y-3">
              {/* 오늘 개강 */}
              {todayOpening.length > 0 && (
                <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl animate-pulse">🎉</span>
                    <div>
                      <p className="text-lg font-black text-emerald-800">오늘 개강!</p>
                      <p className="text-sm text-emerald-600">{todayOpening.length}개 과정이 오늘 시작합니다</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {todayOpening.map(c => (
                      <div key={c.id} className="bg-white rounded-lg border border-emerald-200 px-4 py-3">
                        <p className="font-bold text-sm leading-snug text-slate-800">{c.subject}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                          {c.categoryName}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">{c.startDate} ~ {c.endDate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 오늘 종강 */}
              {todayClosing.length > 0 && (
                <div className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🏁</span>
                    <div>
                      <p className="text-lg font-black text-rose-800">오늘 종강</p>
                      <p className="text-sm text-rose-600">{todayClosing.length}개 과정이 오늘 종강합니다</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {todayClosing.map(c => (
                      <div key={c.id} className="bg-white rounded-lg border border-rose-200 px-4 py-3">
                        <p className="font-bold text-sm leading-snug text-slate-800">{c.subject}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                          {c.categoryName}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">{c.startDate} ~ {c.endDate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 개강 예정 / 종강 임박 */}
              {(openingSoon.length > 0 || closingSoon.length > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {/* 개강 예정 */}
                  <div className="bg-white rounded-xl border border-blue-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">📅</span>
                      <p className="font-black text-sm text-slate-800">개강 예정</p>
                      <span className="ml-auto text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {openingSoon.length}개 · 5일 이내
                      </span>
                    </div>
                    {openingSoon.length === 0 ? (
                      <p className="text-sm text-slate-400">해당 없음</p>
                    ) : (
                      <div className="space-y-2">
                        {openingSoon.map(c => (
                          <div key={c.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-blue-50 border border-blue-100">
                            <span className="text-[10px] font-black text-blue-600 bg-blue-100 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                              {dDayStr(c.startDate, todayStr)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-snug text-slate-800 truncate">{c.subject}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{c.startDate} · {c.categoryName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 종강 임박 */}
                  <div className="bg-white rounded-xl border border-red-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">⏰</span>
                      <p className="font-black text-sm text-slate-800">종강 임박</p>
                      <span className="ml-auto text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        {closingSoon.length}개 · 3일 이내
                      </span>
                    </div>
                    {closingSoon.length === 0 ? (
                      <p className="text-sm text-slate-400">해당 없음</p>
                    ) : (
                      <div className="space-y-2">
                        {closingSoon.map(c => (
                          <div key={c.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-orange-50 border border-orange-100">
                            <span className="text-[10px] font-black text-orange-600 bg-orange-100 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
                              {dDayStr(c.endDate, todayStr)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-snug text-slate-800 truncate">{c.subject}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">종강 {c.endDate} · {c.categoryName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* 통합 월 캘린더 */}
        {allCourses.length > 0 ? (
          <div>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3">
              <button
                onClick={() => setCurrentViewMonth(prev => {
                  const d = new Date(prev.year, prev.month - 1, 1)
                  return { year: d.getFullYear(), month: d.getMonth() }
                })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> 이전 달
              </button>

              <div className="text-center">
                <h2 className="text-xl font-black text-slate-900">
                  {currentViewMonth.year}년 {currentViewMonth.month + 1}월
                </h2>
                {isMonthCurrent(currentViewMonth.year, currentViewMonth.month) && (
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">이번 달 · 수업 날짜 클릭 → 강의장 현황</p>
                )}
                {!isMonthCurrent(currentViewMonth.year, currentViewMonth.month) && (
                  <p className="text-xs text-slate-400 mt-0.5">수업 날짜 클릭 → 강의장 현황</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isMonthCurrent(currentViewMonth.year, currentViewMonth.month) && (
                  <button
                    onClick={() => {
                      const today = new Date()
                      setCurrentViewMonth({ year: today.getFullYear(), month: today.getMonth() })
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    오늘
                  </button>
                )}
                <button
                  onClick={() => setCurrentViewMonth(prev => {
                    const d = new Date(prev.year, prev.month + 1, 1)
                    return { year: d.getFullYear(), month: d.getMonth() }
                  })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  다음 달 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div
                    key={d}
                    className={`py-2.5 text-center text-[11px] font-black tracking-widest ${
                      i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-600' : 'text-slate-500'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Date rows */}
              {buildMonthGrid(currentViewMonth.year, currentViewMonth.month).map((row, ri) => (
                <div key={ri} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
                  {row.map((day, ci) => (
                    <React.Fragment key={ci}>{renderUnifiedDay(day)}</React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] border-4 border-dashed border-slate-200 text-slate-300">
            <Table2 className="w-24 h-24 mb-4 opacity-20" />
            <p className="text-xl font-black">
              엑셀 파일을 드래그하거나 업로드 버튼을 누르세요.
            </p>
            <p className="text-sm mt-2 opacity-60">
              폴더 업로드 시 폴더명이 카테고리로 자동 분류됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
