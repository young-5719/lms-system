'use client'

import React, { useState, useEffect } from 'react'
import { X, LayoutGrid, User, Clock, AlertTriangle } from 'lucide-react'

// ─── Types (mirrored from training-calendar) ──────────────────────────────────

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

interface MatrixCell {
  occupied: boolean
  subject?: string
  fileName?: string
  courseName?: string
  instructor?: string
  notices?: string[]
  courseId?: string
}

interface CellRenderInfo {
  skip: boolean
  rowSpan: number
  occupied: boolean
  subject?: string
  fileName?: string
  courseName?: string
  instructor?: string
  notices?: string[]
  courseId?: string
}

// ─── Serialized shapes (for localStorage) ────────────────────────────────────

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

const DEFAULT_ROOMS = [
  '601호', '602호', '603호', '604호', '605호',
  '606호', '607호', '608호', '609호', '610호',
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getSubjectColor(subject: string) {
  let hash = 0
  const s = String(subject || '-')
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length]
}

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

const maskName = (n: string | undefined): string => {
  if (!n) return '-'
  const str = String(n).trim()
  if (str.length <= 1) return str
  if (str.length === 2) return str[0] + '*'
  return str[0] + '*' + str.substring(2)
}

function getTimeColor(start: string): { bg: string; text: string; border: string } {
  const hour = parseInt(start.split(':')[0])
  if (hour < 19) return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' }
  return { bg: 'bg-slate-200', text: 'text-slate-600', border: 'border-slate-300' }
}

function isUnemployedCat(catName: string): boolean {
  return catName.includes('실업자') || catName.includes('국기') || catName.includes('내일배움')
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
        courseName: info.courseName, notices: info.notices, courseId: info.courseId,
      }
      for (let j = 1; j < span; j++) {
        grid[room][usedSlots[i + j].start] = { skip: true, rowSpan: 1, occupied: true }
      }
      i += span
    }
  }

  return grid
}

// Get Mon-Sun week containing the given date
function getWeekDays(date: Date): Date[] {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ...
  // Monday-based: if Sunday (0) treat as day 7
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMon)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCalendar() {
  const [categories, setCategories] = useState<Category[]>([])
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [selectedModalCourse, setSelectedModalCourse] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lms-training-data')
      if (raw) {
        const parsed = JSON.parse(raw)
        const cats = deserializeCategories(parsed.categories ?? [])
        if (cats.length > 0) setCategories(cats)
      }
    } catch { /* no-op */ }
    setInitialized(true)
  }, [])

  // Reset sub-popup when main modal changes
  useEffect(() => { setSelectedModalCourse(null) }, [modalDate])

  const allCourses = categories.flatMap(cat => cat.courses)
  const today = new Date()
  const todayStr = getLocalDateString(today)
  const weekDays = getWeekDays(today)

  // Compute room matrix for a given date
  const computeRoomMatrix = (dateStr: string) => {
    const allSessions = allCourses.flatMap(c => {
      const { subject } = parseCourseFileName(c.fileName)
      const fullName = c.fileName.replace(/\.(xlsx|xls)$/i, '')
      const dayData = c.data[dateStr]
      const notices = [
        ...(c.alerts[dateStr] ?? []),
        ...(dayData?.isDiscretionary ? ['재량교과'] : []),
      ]
      return (dayData?.sessions ?? []).map(s => ({
        ...s,
        subject,
        fileName: fullName,
        notices,
        courseId: c.id,
      }))
    })

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
          ? { occupied: true, subject: session.subject, courseName: session.courseName, instructor: session.instructor, fileName: session.fileName, notices: session.notices, courseId: session.courseId }
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

  // ── Modal ──────────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modalDate) return null
    const { rooms, matrix, usedSlots, hasData } = computeRoomMatrix(modalDate)
    const cellGrid = computeCellGrid(rooms, usedSlots, matrix)
    const dateObj = new Date(modalDate + 'T00:00:00')
    const [, mStr, dStr] = modalDate.split('-')
    const dayName = WEEKDAYS[dateObj.getDay()]

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

    const selectedEntry = perCourseData.find(e => e.id === selectedModalCourse) ?? null

    return (
      <>
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

            <div className="overflow-auto flex-1 p-5">
              {!hasData ? (
                <div className="py-10 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  해당 날짜에 등록된 수업이 없습니다
                </div>
              ) : (
                <section>
                  <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" /> 강의장 시간표
                    <span className="text-[11px] font-normal normal-case text-slate-400">· 과정 클릭 시 세부 정보</span>
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
                                const isSelected = selectedModalCourse === cell.courseId
                                return (
                                  <td
                                    key={room}
                                    rowSpan={cell.rowSpan}
                                    onClick={() => setSelectedModalCourse(isSelected ? null : (cell.courseId ?? null))}
                                    className={[
                                      `p-2 border-b border-r last:border-r-0 ${sc.bg} align-top cursor-pointer transition-all`,
                                      isSelected
                                        ? `ring-2 ring-inset ring-blue-500 ${sc.border}`
                                        : `${sc.border} hover:brightness-95`,
                                    ].join(' ')}
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
                                      {cell.notices && cell.notices.length > 0 && (
                                        <div className="mt-1 pt-1 border-t border-dashed border-red-200 space-y-0.5">
                                          {cell.notices.map((n, ni) => (
                                            <div key={ni} className="flex items-start gap-0.5">
                                              <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0 mt-0.5" />
                                              <span className="text-[9px] text-red-600 font-bold leading-tight">{n}</span>
                                            </div>
                                          ))}
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

        {/* 과정 세부 팝업 */}
        {selectedEntry && (() => {
          const sc = getSubjectColor(selectedEntry.subject)
          return (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              onClick={() => setSelectedModalCourse(null)}
            >
              <div
                className={`bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto border-2 ${sc.border}`}
                onClick={e => e.stopPropagation()}
              >
                <div className={`flex items-start justify-between gap-2 p-5 border-b ${sc.border}`}>
                  <div>
                    <p className={`font-black text-lg leading-snug ${sc.text}`}>{selectedEntry.subject}</p>
                    <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                      {selectedEntry.catName}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedModalCourse(null)}
                    className="text-slate-300 hover:text-slate-600 transition-colors shrink-0 mt-0.5 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-black text-slate-700">{selectedEntry.timeRange}</span>
                  </div>
                  {selectedEntry.subjects.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedEntry.subjects.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${sc.text.replace('text-', 'bg-')}`} />
                          <span className="text-sm text-slate-700 leading-snug">{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedEntry.instructors.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-500">
                        {selectedEntry.instructors.map(maskName).join(' · ')}
                      </span>
                    </div>
                  )}
                  {selectedEntry.notices.length > 0 && (
                    <div className="pt-3 border-t-2 border-red-100 space-y-2">
                      {selectedEntry.notices.map((n, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-sm font-black text-red-600 leading-snug">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </>
    )
  }

  // ── Week grid ──────────────────────────────────────────────────────────────

  if (!initialized) return null
  if (categories.length === 0) return null

  return (
    <>
      {renderModal()}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>🗓️</span> 이번 주 강의 일정
          <span className="text-xs font-normal text-slate-400 ml-1">날짜 클릭 → 강의장 현황</span>
        </h3>

        <div className="grid grid-cols-7 gap-1 rounded-xl border border-slate-200 overflow-hidden bg-white">
          {/* Day header row */}
          {weekDays.map((day, idx) => {
            const dayNum = day.getDay() // 0=Sun,1=Mon,...
            const isWeekend = dayNum === 0 || dayNum === 6
            return (
              <div
                key={idx}
                className={[
                  'text-center text-xs font-bold py-1.5 border-b border-slate-100',
                  isWeekend ? 'text-rose-400' : 'text-slate-500',
                ].join(' ')}
              >
                {WEEKDAYS[dayNum]}
              </div>
            )
          })}

          {/* Day cells */}
          {weekDays.map((day, idx) => {
            const dateStr = getLocalDateString(day)
            const isToday = dateStr === todayStr
            const dayNum = day.getDay()
            const isSunday = dayNum === 0
            const isSaturday = dayNum === 6

            // Collect alerts for this day
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
                key={idx}
                onClick={() => hasData && setModalDate(dateStr)}
                className={[
                  'p-1.5 flex flex-col min-h-[90px] border-r border-slate-100 last:border-r-0 transition-colors',
                  !hasData
                    ? 'bg-slate-50'
                    : isSunday
                    ? 'bg-rose-50/20'
                    : isToday
                    ? 'bg-blue-50/40'
                    : 'bg-white',
                  hasData ? 'cursor-pointer hover:bg-blue-50/50' : '',
                  modalDate === dateStr ? 'ring-2 ring-inset ring-blue-500' : '',
                ].join(' ')}
              >
                {/* Date number */}
                <span
                  className={[
                    'text-sm font-black w-6 h-6 flex items-center justify-center rounded-md mb-1 shrink-0',
                    isToday
                      ? 'bg-blue-600 text-white'
                      : isSunday
                      ? 'text-rose-500'
                      : isSaturday
                      ? 'text-blue-600'
                      : 'text-slate-700',
                    !hasData ? 'opacity-30' : '',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>

                {hasAnyNotice ? (
                  <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                    {unemployedNotices.slice(0, 3).map((n, i) => (
                      <span
                        key={`u-${i}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#1e40af',
                          backgroundColor: '#dbeafe',
                          border: '1px solid #93c5fd',
                          borderRadius: '4px',
                          padding: '0 4px',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.4',
                        }}
                      >
                        {n}
                      </span>
                    ))}
                    {employedNotices.slice(0, 2).map((n, i) => (
                      <span
                        key={`e-${i}`}
                        style={{
                          fontSize: '9px',
                          color: '#94a3b8',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.25',
                        }}
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
          })}
        </div>
      </div>
    </>
  )
}
