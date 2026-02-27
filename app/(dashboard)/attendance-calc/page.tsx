'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  CheckCircle, Trash2, User, LayoutGrid,
  BookOpen, Users, Clock, ShieldCheck, ChevronRight,
  Plus, X, RefreshCw, Wifi, Upload,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface ProcessedScheduleItem {
  date: string
  type: string
  start: number | null
  end: number | null
  duration: number
  unit: string
  isNcs: boolean
  subject: string
}

interface StudentData {
  name: string
  attendanceByUnit: Record<string, number>
  isDroppedOut: boolean
}

interface UploadedFile {
  id: string
  name: string
  type: string
  date: string
}

interface ChartItem {
  name: string
  shortName: string
  rate: number
  attended: number
  total: number
}

interface CourseConfig {
  id: string
  name: string
  courseCodeId: string
  round: string
  startDate: string  // YYYYMMDD
  endDate: string    // YYYYMMDD
}

// 지각/결석/외출/조퇴 → 실시간 계산 / 그 외 모든 상태 → 정상 출석 전일 인정
const PARTIAL_STATUSES = ['지각', '외출', '조퇴'] as const
const ABSENT_STATUS = '결석'

interface DayDetail {
  attended: number
  checkIn: string
  checkOut: string
  isFullCredit: boolean  // 정상 출석 인정 여부 (지각/결석/외출/조퇴 외 모든 상태)
  status: string
}

interface CourseRuntime {
  schedule: ScheduleRow[]
  attendanceRecords: ScheduleRow[]
  uploadedFiles: UploadedFile[]
  isLoadingAttendance: boolean
  attendanceError: string | null
  selectedStudent: string | null
  selectedUnit: string | null
  viewMode: 'individual' | 'overall'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

const normalizeDate = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return ''
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const s = String(val).replace(/[^0-9]/g, '')
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return String(val).replace(/\./g, '-').trim()
}

const timeToMinutes = (timeVal: string | number | null | undefined): number | null => {
  if (!timeVal || timeVal === '-' || timeVal === '') return null
  if (typeof timeVal === 'string') {
    const parts = timeVal.split(':')
    if (parts.length < 2) return null
    return parseInt(parts[0]) * 60 + parseInt(parts[1])
  }
  if (typeof timeVal === 'number' && timeVal < 1) return Math.round(timeVal * 1440)
  return null
}

const processExcelData = (rows: (string | number | null)[][]): ScheduleRow[] => {
  if (!rows || rows.length === 0) return []
  let headerRowIndex = -1
  let headers: string[] = []
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = (rows[i] || []).map((cell) => String(cell || '').replace(/\s/g, ''))
    if (row.includes('성명') || row.includes('훈련일자') || row.includes('입실시간')) {
      headerRowIndex = i
      headers = rows[i].map((h) => String(h || '').trim())
      break
    }
  }
  if (headerRowIndex === -1) {
    headers = (rows[0] || []).map((h) => String(h || '').trim())
    headerRowIndex = 0
  }
  const result: ScheduleRow[] = []
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const rowData = rows[i]
    if (!rowData || rowData.length === 0) continue
    const obj: ScheduleRow = {}
    let hasData = false
    headers.forEach((header, idx) => {
      const key = header || `col_${idx}`
      const val = rowData[idx]
      obj[key] = val !== undefined ? val : null
      if (val) hasData = true
    })
    if (hasData) result.push(obj)
  }
  return result
}

const fmtMin = (m: number) => {
  if (m <= 0) return '충족'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `+${min}분`
  if (min === 0) return `+${h}시간`
  return `+${h}시간 ${min}분`
}

const makeEmptyRuntime = (): CourseRuntime => ({
  schedule: [],
  attendanceRecords: [],
  uploadedFiles: [],
  isLoadingAttendance: false,
  attendanceError: null,
  selectedStudent: null,
  selectedUnit: null,
  viewMode: 'individual',
})

const STORAGE_KEY = 'attendance-calc-courses'
const ACTIVE_COURSE_KEY = 'attendance-calc-active'

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendanceCalcPage() {
  const [courses, setCourses] = useState<CourseConfig[]>([])
  const [activeCourseId, setActiveCourseId] = useState<string>('')
  const [runtimeData, setRuntimeData] = useState<Record<string, CourseRuntime>>({})
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabName, setEditingTabName] = useState('')

  const scheduleInputRef = useRef<HTMLInputElement>(null)

  // ─── localStorage 초기 로드 ────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const storedActive = localStorage.getItem(ACTIVE_COURSE_KEY)
      if (stored) {
        const parsed: CourseConfig[] = JSON.parse(stored)
        if (parsed.length > 0) {
          setCourses(parsed)
          const activeId = storedActive && parsed.find(c => c.id === storedActive)
            ? storedActive
            : parsed[0].id
          setActiveCourseId(activeId)
          const initRuntime: Record<string, CourseRuntime> = {}
          parsed.forEach(c => { initRuntime[c.id] = makeEmptyRuntime() })
          setRuntimeData(initRuntime)
          return
        }
      }
    } catch (_) { /* ignore */ }
    addCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (courses.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  }, [courses])

  useEffect(() => {
    if (activeCourseId) localStorage.setItem(ACTIVE_COURSE_KEY, activeCourseId)
  }, [activeCourseId])

  // ─── 과정 CRUD ─────────────────────────────────────────────────────────────

  const addCourse = useCallback(() => {
    if (courses.length >= 5) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newCourse: CourseConfig = {
      id,
      name: `과정 ${courses.length + 1}`,
      courseCodeId: '',
      round: '1',
      startDate: '',
      endDate: '',
    }
    setCourses(prev => [...prev, newCourse])
    setRuntimeData(prev => ({ ...prev, [id]: makeEmptyRuntime() }))
    setActiveCourseId(id)
  }, [courses.length])

  const removeCourse = useCallback((id: string) => {
    if (!confirm('이 과정을 삭제하시겠습니까?\n설정과 데이터가 모두 제거됩니다.')) return
    const remaining = courses.filter(c => c.id !== id)

    if (remaining.length === 0) {
      // 마지막 과정 삭제 시 빈 과정 하나 자동 생성
      const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newCourse: CourseConfig = { id: newId, name: '과정 1', courseCodeId: '', round: '1', startDate: '', endDate: '' }
      setCourses([newCourse])
      setRuntimeData({ [newId]: makeEmptyRuntime() })
      setActiveCourseId(newId)
    } else {
      setCourses(remaining)
      setRuntimeData(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setActiveCourseId(prev => prev !== id ? prev : remaining[0].id)
    }
  }, [courses])

  const updateCourseConfig = useCallback((id: string, patch: Partial<CourseConfig>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const updateRuntime = useCallback((id: string, patch: Partial<CourseRuntime>) => {
    setRuntimeData(prev => ({
      ...prev,
      [id]: { ...(prev[id] || makeEmptyRuntime()), ...patch },
    }))
  }, [])

  const activeConfig = courses.find(c => c.id === activeCourseId)
  const activeRuntime = runtimeData[activeCourseId] || makeEmptyRuntime()

  // ─── 시간표 처리 ───────────────────────────────────────────────────────────

  const processedSchedule = useMemo((): ProcessedScheduleItem[] => {
    return activeRuntime.schedule
      .filter(row =>
        (String(row['구분']) === '훈련' || String(row['구분']) === '점심') &&
        (row['NCS능력단위'] || row['교과목'] || String(row['구분']) === '점심')
      )
      .map(row => {
        const type = String(row['구분']).trim()
        const unit = String(row['NCS능력단위'] || '').trim()
        const subject = String(row['교과목'] || '').trim()
        const targetKey = unit || subject || (type === '점심' ? 'LUNCH' : '정의되지 않은 교과')
        return {
          date: normalizeDate(row['훈련일자']),
          type,
          start: timeToMinutes(row['시작시간']),
          end: timeToMinutes(row['종료시간']),
          duration: parseInt(row['적용시간(분)']) || 0,
          unit: targetKey,
          isNcs: !!unit,
          subject,
        }
      })
  }, [activeRuntime.schedule])

  const dailyTrainingBounds = useMemo(() => {
    const bounds: Record<string, { start: number; end: number }> = {}
    processedSchedule.forEach(item => {
      if (item.type !== '훈련' || item.start === null || item.end === null) return
      if (!bounds[item.date]) {
        bounds[item.date] = { start: item.start, end: item.end }
      } else {
        bounds[item.date].start = Math.min(bounds[item.date].start, item.start)
        bounds[item.date].end = Math.max(bounds[item.date].end, item.end)
      }
    })
    return bounds
  }, [processedSchedule])

  const totalMinutesPerUnit = useMemo(() => {
    const map: Record<string, number> = {}
    processedSchedule.forEach(item => {
      if (item.type === '훈련') map[item.unit] = (map[item.unit] || 0) + item.duration
    })
    return map
  }, [processedSchedule])

  const grandTotalMinutes = useMemo(
    () => Object.values(totalMinutesPerUnit).reduce((acc, val) => acc + val, 0),
    [totalMinutesPerUnit]
  )

  // ─── 중도탈락 학생 감지 ────────────────────────────────────────────────────

  const droppedOutStudents = useMemo(() => {
    const set = new Set<string>()
    activeRuntime.attendanceRecords.forEach(r => {
      if (String(r['처리상태'] || '').includes('중도탈락')) {
        const nm = String(r['성명'] || '').trim()
        if (nm) set.add(nm)
      }
    })
    return set
  }, [activeRuntime.attendanceRecords])

  // ─── 학생별 출석 계산 ──────────────────────────────────────────────────────

  const studentData = useMemo((): Record<string, StudentData> => {
    const records = activeRuntime.attendanceRecords
    if (!processedSchedule.length || !records.length) return {}
    const students: Record<string, StudentData> = {}

    records.forEach(record => {
      const name = String(record['성명'] || '').trim()
      const date = String(record['출결일자'] || '')
      if (!name || !date) return
      if (!students[name]) {
        students[name] = { name, attendanceByUnit: {}, isDroppedOut: droppedOutStudents.has(name) }
      }

      const status = String(record['처리상태'] || '').trim()
      const isAbsent = status === ABSENT_STATUS
      const isPartial = (PARTIAL_STATUSES as readonly string[]).includes(status)
      const isFullCredit = !isAbsent && !isPartial

      const checkIn = timeToMinutes(record['입실시간'] || null)
      const checkOut = timeToMinutes(record['퇴실시간'] || null)
      const bounds = dailyTrainingBounds[date]
      if (!bounds) return

      processedSchedule
        .filter(s => s.date === date)
        .forEach(block => {
          if (block.type !== '훈련') return
          let attended = 0
          if (isAbsent) {
            attended = 0
          } else if (isFullCredit) {
            attended = block.duration
          } else if (checkIn !== null && checkOut !== null && block.start !== null && block.end !== null) {
            // 10분 유예 적용
            // 입실: 수업 개시 후 10분 이내 입실 → 정시 출석으로 인정
            const recognizedIn = checkIn <= bounds.start + 10 ? bounds.start : checkIn
            // 퇴실: 수업 종료 10분 전부터 퇴실 → 정시 퇴실로 인정 (쉬는시간 포함)
            const recognizedOut = checkOut >= bounds.end - 10 ? bounds.end : checkOut
            // 수업 범위 클리핑 후 블록별 겹치는 시간 계산
            const effectiveIn = Math.max(recognizedIn, bounds.start)
            const effectiveOut = Math.min(recognizedOut, bounds.end)
            const overlapStart = Math.max(effectiveIn, block.start)
            const overlapEnd = Math.min(effectiveOut, block.end)
            attended = Math.max(0, overlapEnd - overlapStart)
          }
          students[name].attendanceByUnit[block.unit] =
            (students[name].attendanceByUnit[block.unit] || 0) + attended
        })
    })
    return students
  }, [processedSchedule, activeRuntime.attendanceRecords, dailyTrainingBounds, droppedOutStudents])

  // ─── 과목별 일별 상세 출결 ────────────────────────────────────────────────

  const unitDetailData = useMemo(() => {
    const selUnit = activeRuntime.selectedUnit
    if (!selUnit) return null

    const unitBlocks = processedSchedule.filter(s => s.unit === selUnit && s.type === '훈련')
    if (!unitBlocks.length) return null

    const dates = [...new Set(unitBlocks.map(b => b.date))].sort()
    const minutesPerDate: Record<string, number> = {}
    dates.forEach(date => {
      minutesPerDate[date] = unitBlocks
        .filter(b => b.date === date)
        .reduce((sum, b) => sum + b.duration, 0)
    })

    // 전체 학생 × 날짜 행렬 초기화 (null = 기록 없음)
    const rows: Record<string, Record<string, DayDetail | null>> = {}
    Object.keys(studentData).forEach(name => {
      rows[name] = {}
      dates.forEach(date => { rows[name][date] = null })
    })

    // 출결 기록으로 채우기
    activeRuntime.attendanceRecords.forEach(record => {
      const name = String(record['성명'] || '').trim()
      const date = String(record['출결일자'] || '')
      if (!name || !date || !dates.includes(date) || !rows[name]) return

      const recStatus = String(record['처리상태'] || '').trim()
      const recIsAbsent = recStatus === ABSENT_STATUS
      const recIsPartial = (PARTIAL_STATUSES as readonly string[]).includes(recStatus)
      const isFullCredit = !recIsAbsent && !recIsPartial

      const checkInMin = timeToMinutes(String(record['입실시간'] || ''))
      const checkOutMin = timeToMinutes(String(record['퇴실시간'] || ''))
      const bounds = dailyTrainingBounds[date]
      if (!bounds) return

      let attended = 0
      unitBlocks.filter(b => b.date === date).forEach(block => {
        if (recIsAbsent) {
          // attended stays 0
        } else if (isFullCredit) {
          attended += block.duration
        } else if (checkInMin !== null && checkOutMin !== null && block.start !== null && block.end !== null) {
          const recognizedIn = checkInMin <= bounds.start + 10 ? bounds.start : checkInMin
          const recognizedOut = checkOutMin >= bounds.end - 10 ? bounds.end : checkOutMin
          const effectiveIn = Math.max(recognizedIn, bounds.start)
          const effectiveOut = Math.min(recognizedOut, bounds.end)
          const overlapStart = Math.max(effectiveIn, block.start)
          const overlapEnd = Math.min(effectiveOut, block.end)
          attended += Math.max(0, overlapEnd - overlapStart)
        }
      })

      rows[name][date] = {
        attended,
        checkIn: String(record['입실시간'] || ''),
        checkOut: String(record['퇴실시간'] || ''),
        isFullCredit,
        status: recStatus,
      }
    })

    return { unit: selUnit, dates, minutesPerDate, rows }
  }, [activeRuntime.selectedUnit, processedSchedule, activeRuntime.attendanceRecords, dailyTrainingBounds, studentData])

  // ─── 시간표 업로드 ─────────────────────────────────────────────────────────

  const handleScheduleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) continue
      const reader = new FileReader()
      reader.onload = (evt) => {
        const workbook = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const parsed = processExcelData(
          XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number | null)[][]
        )
        const fileId = `${file.name}-${file.size}`
        updateRuntime(activeCourseId, {
          schedule: parsed,
          uploadedFiles: [
            ...activeRuntime.uploadedFiles.filter(f => f.type !== '훈련일정'),
            { id: fileId, name: file.name, type: '훈련일정', date: '-' },
          ],
        })
      }
      reader.readAsArrayBuffer(file)
    }
    e.target.value = ''
  }

  // ─── HRD-Net API 가져오기 ──────────────────────────────────────────────────

  const fetchAttendanceFromApi = async () => {
    if (!activeConfig) return
    const { courseCodeId, round, startDate, endDate } = activeConfig
    if (!courseCodeId || !round || !startDate || !endDate) {
      updateRuntime(activeCourseId, { attendanceError: '과목코드, 회차, 시작일, 종료일을 모두 입력하세요.' })
      return
    }
    updateRuntime(activeCourseId, { isLoadingAttendance: true, attendanceError: null })
    try {
      const params = new URLSearchParams({ courseCodeId, round, startDate, endDate })
      const res = await fetch(`/api/attendance-raw?${params}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      updateRuntime(activeCourseId, {
        attendanceRecords: data.records || [],
        isLoadingAttendance: false,
        uploadedFiles: [
          ...activeRuntime.uploadedFiles.filter(f => f.type !== 'API출결'),
          {
            id: 'api',
            name: `HRD-Net (${data.total}건)`,
            type: 'API출결',
            date: new Date().toLocaleDateString('ko-KR'),
          },
        ],
      })
    } catch (err: unknown) {
      updateRuntime(activeCourseId, {
        isLoadingAttendance: false,
        attendanceError: err instanceof Error ? err.message : '가져오기 실패',
      })
    }
  }

  // ─── 초기화 ────────────────────────────────────────────────────────────────

  const clearCurrentCourse = () => {
    if (!confirm('현재 과정의 모든 데이터를 초기화하시겠습니까?')) return
    updateRuntime(activeCourseId, makeEmptyRuntime())
    if (scheduleInputRef.current) scheduleInputRef.current.value = ''
  }

  // ─── 차트 / 학생 목록 ──────────────────────────────────────────────────────

  const studentList = Object.values(studentData).sort((a, b) => a.name.localeCompare(b.name))
  const unitList = Object.keys(totalMinutesPerUnit)
  const { selectedStudent, viewMode } = activeRuntime

  const chartData: ChartItem[] = selectedStudent
    ? unitList.map(unitKey => {
        const total = totalMinutesPerUnit[unitKey]
        const attended = studentData[selectedStudent]?.attendanceByUnit[unitKey] || 0
        return {
          name: unitKey,
          shortName: unitKey.length > 15 ? unitKey.substring(0, 15) + '...' : unitKey,
          rate: parseFloat(((attended / total) * 100).toFixed(1)),
          attended,
          total,
        }
      })
    : []

  // ─── Render ────────────────────────────────────────────────────────────────

  if (courses.length === 0) return null

  return (
    <div className="min-h-screen p-4 md:p-6 bg-slate-50">

      {/* 헤더 */}
      <header className="max-w-7xl mx-auto mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white flex items-center shadow-lg">
              <CheckCircle size={24} />
            </div>
            NCS 정밀 출석 분석 시스템
          </h1>
          <p className="text-slate-500 mt-1 ml-1 text-sm">
            훈련 기준(75%) 진단 및 점심시간 자동 제외 분석
          </p>
        </div>
        <button
          onClick={clearCurrentCourse}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-md font-bold text-sm"
        >
          <Trash2 size={16} /> 과정 데이터 초기화
        </button>
      </header>

      {/* 과정 탭 */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {courses.map(course => (
            <div
              key={course.id}
              className={`group flex items-center gap-1 px-3 py-2 rounded-xl cursor-pointer text-sm font-bold transition-all shrink-0 ${
                activeCourseId === course.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              onClick={() => setActiveCourseId(course.id)}
              onDoubleClick={() => { setEditingTabId(course.id); setEditingTabName(course.name) }}
            >
              {editingTabId === course.id ? (
                <input
                  autoFocus
                  className="bg-transparent border-b border-white outline-none w-24 text-sm"
                  value={editingTabName}
                  onChange={e => setEditingTabName(e.target.value)}
                  onBlur={() => {
                    if (editingTabName.trim()) updateCourseConfig(course.id, { name: editingTabName.trim() })
                    setEditingTabId(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (editingTabName.trim()) updateCourseConfig(course.id, { name: editingTabName.trim() })
                      setEditingTabId(null)
                    }
                    if (e.key === 'Escape') setEditingTabId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="max-w-[120px] truncate">{course.name}</span>
              )}
              <button
                className={`ml-1.5 rounded hover:text-rose-400 transition-colors ${
                  activeCourseId === course.id ? 'text-indigo-300' : 'text-slate-400'
                }`}
                title="이 과정 삭제"
                onClick={e => { e.stopPropagation(); removeCourse(course.id) }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {courses.length < 5 && (
            <button
              onClick={addCourse}
              className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all text-sm font-bold border border-dashed border-slate-300 shrink-0"
            >
              <Plus size={14} /> 과정 추가
            </button>
          )}
        </div>
      </div>

      {/* 뷰 모드 탭 */}
      <div className="max-w-7xl mx-auto mb-4 flex p-1 bg-slate-200 rounded-2xl w-fit">
        <button
          onClick={() => updateRuntime(activeCourseId, { viewMode: 'individual' })}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            viewMode === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <User size={15} /> 개인별 분석
        </button>
        <button
          onClick={() => updateRuntime(activeCourseId, { viewMode: 'overall' })}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            viewMode === 'overall' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutGrid size={15} /> 전체 현황표
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 전체 현황표 모드: 풀 와이드 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {viewMode === 'overall' ? (
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <LayoutGrid className="text-indigo-600" size={18} />
                전체 학생 이수 현황
                <span className="text-xs font-normal text-slate-500 ml-1">기준: 각 과목 75% 이상</span>
              </h2>
              {studentList.length > 0 && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> 충족
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-rose-400 inline-block" /> 미달
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-300 inline-block" /> 중도탈락
                  </span>
                </div>
              )}
            </div>

            {studentList.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <LayoutGrid size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold">데이터가 없습니다.</p>
                <p className="text-sm mt-1">시간표를 업로드하고 HRD-Net 출결을 가져오세요.</p>
              </div>
            ) : (
              <>
              <div className="overflow-auto">
                <table className="w-full text-sm border-collapse">
                  {/* 헤더 */}
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-bold sticky left-0 bg-slate-800 z-20 min-w-[80px] border-r border-slate-600">
                        성명
                      </th>
                      {unitList.map((unit, i) => {
                        const isSelected = activeRuntime.selectedUnit === unit
                        return (
                          <th
                            key={i}
                            className={`px-3 py-3 text-center font-bold min-w-[140px] border-r border-slate-600 cursor-pointer select-none transition-colors ${
                              isSelected
                                ? 'bg-indigo-500 ring-2 ring-inset ring-indigo-300'
                                : 'hover:bg-slate-700'
                            }`}
                            title="클릭하면 일별 상세 출결을 볼 수 있습니다"
                            onClick={() => updateRuntime(activeCourseId, {
                              selectedUnit: isSelected ? null : unit,
                            })}
                          >
                            <div className="flex flex-col gap-1 items-center">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                processedSchedule.find(s => s.unit === unit)?.isNcs
                                  ? 'bg-indigo-400 text-white'
                                  : 'bg-slate-500 text-slate-200'
                              }`}>
                                {processedSchedule.find(s => s.unit === unit)?.isNcs ? 'NCS' : 'Subject'}
                              </span>
                              <span className="leading-snug text-xs break-words max-w-[130px]" title={unit}>
                                {unit}
                              </span>
                              <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {isSelected ? '▲ 상세 닫기' : '▼ 상세 보기'}
                              </span>
                            </div>
                          </th>
                        )
                      })}
                      <th className="px-3 py-3 text-center font-bold sticky right-0 bg-indigo-700 z-20 min-w-[110px]">
                        이수 현황
                      </th>
                    </tr>
                    {/* 기준 행 */}
                    <tr className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-600">
                      <th className="px-4 py-2 text-left font-bold sticky left-0 bg-slate-100 z-20 border-r border-slate-200">
                        75% 기준
                      </th>
                      {unitList.map((unit, i) => {
                        const total = totalMinutesPerUnit[unit]
                        const needed = Math.ceil(total * 0.75)
                        return (
                          <th key={i} className="px-3 py-2 text-center font-normal border-r border-slate-200">
                            <span className="text-slate-500">총 {Math.floor(total / 60) > 0 ? `${Math.floor(total / 60)}h ` : ''}{total % 60 > 0 ? `${total % 60}m` : ''}</span>
                            <br />
                            <span className="text-amber-600 font-bold">기준 {Math.floor(needed / 60) > 0 ? `${Math.floor(needed / 60)}h ` : ''}{needed % 60 > 0 ? `${needed % 60}m` : ''}</span>
                          </th>
                        )
                      })}
                      <th className="px-3 py-2 sticky right-0 bg-slate-100 z-20 border-l border-slate-200" />
                    </tr>
                  </thead>

                  {/* 바디 */}
                  <tbody className="divide-y divide-slate-200">
                    {studentList.map((student, sIdx) => {
                      const isDropped = student.isDroppedOut
                      let totalAttended = 0
                      let totalNeeded = 0

                      // 전체 이수 현황 계산
                      unitList.forEach(unit => {
                        const total = totalMinutesPerUnit[unit]
                        const attended = student.attendanceByUnit[unit] || 0
                        totalAttended += attended
                        const unitNeeded = Math.max(0, Math.ceil(total * 0.75) - attended)
                        totalNeeded += unitNeeded
                      })

                      const rowBase = isDropped
                        ? 'bg-slate-100 opacity-60'
                        : 'bg-white hover:bg-slate-50 transition-colors'

                      return (
                        <tr key={sIdx} className={rowBase}>
                          {/* 성명 */}
                          <td className={`px-4 py-3 font-bold sticky left-0 z-10 border-r border-slate-200 ${
                            isDropped ? 'bg-slate-100' : 'bg-white'
                          }`}>
                            <div className="flex flex-col gap-0.5">
                              <span>{student.name}</span>
                              {isDropped && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-400 text-white rounded font-bold w-fit">
                                  중도탈락
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 단위별 셀 */}
                          {unitList.map((unit, uIdx) => {
                            const total = totalMinutesPerUnit[unit]
                            const attended = student.attendanceByUnit[unit] || 0
                            const rate = total > 0 ? (attended / total) * 100 : 0
                            const needed = Math.max(0, Math.ceil(total * 0.75) - attended)
                            const isMet = needed === 0

                            if (isDropped) {
                              return (
                                <td key={uIdx} className="px-3 py-3 text-center border-r border-slate-200 text-slate-400 text-xs">
                                  —
                                </td>
                              )
                            }

                            return (
                              <td key={uIdx} className={`px-3 py-3 text-center border-r border-slate-200 ${
                                isMet ? 'bg-emerald-50' : 'bg-rose-50'
                              }`}>
                                <div className="font-bold text-sm">
                                  <span className={isMet ? 'text-emerald-700' : 'text-rose-600'}>
                                    {rate.toFixed(1)}%
                                  </span>
                                </div>
                                <div className={`text-xs mt-0.5 font-medium ${isMet ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {isMet ? '✓ 충족' : fmtMin(needed) + ' 필요'}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {attended}분 출석
                                </div>
                              </td>
                            )
                          })}

                          {/* 이수 현황 (합계) */}
                          <td className={`px-3 py-3 text-center sticky right-0 z-10 border-l-2 border-slate-300 ${
                            isDropped ? 'bg-slate-100' : totalNeeded === 0 ? 'bg-indigo-50' : 'bg-amber-50'
                          }`}>
                            {isDropped ? (
                              <span className="text-slate-400 text-sm font-bold">—</span>
                            ) : totalNeeded === 0 ? (
                              <div>
                                <div className="text-emerald-700 font-bold text-sm">✓ 수료 가능</div>
                                <div className="text-[11px] text-emerald-600 mt-0.5">{Math.floor(totalAttended / 60)}h {totalAttended % 60}m</div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-amber-700 font-bold text-sm">{fmtMin(totalNeeded)}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">추가 필요</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── 과목 상세 출결 패널 ── */}
              {unitDetailData && (
                <div className="border-t-2 border-indigo-200">
                  {/* 패널 헤더 */}
                  <div className="px-6 py-4 bg-indigo-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                        {unitDetailData.unit} — 일별 출결 상세
                      </h3>
                      <p className="text-xs text-indigo-500 mt-0.5">
                        총 {unitDetailData.dates.length}일 수업 ·
                        총 {Object.values(unitDetailData.minutesPerDate).reduce((a, b) => a + b, 0)}분
                      </p>
                    </div>
                    <button
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-bold px-3 py-1.5 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                      onClick={() => updateRuntime(activeCourseId, { selectedUnit: null })}
                    >
                      닫기 ✕
                    </button>
                  </div>

                  {/* 상세 테이블 */}
                  <div className="overflow-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-indigo-700 text-white">
                          <th className="px-4 py-2.5 text-left font-bold sticky left-0 bg-indigo-700 z-20 min-w-[80px] border-r border-indigo-500">
                            학생명
                          </th>
                          {unitDetailData.dates.map(date => (
                            <th key={date} className="px-3 py-2.5 text-center font-bold min-w-[100px] border-r border-indigo-500">
                              <div className="font-bold">{date.slice(5).replace('-', '/')}</div>
                              <div className="text-[10px] font-normal text-indigo-200 mt-0.5">
                                {unitDetailData.minutesPerDate[date]}분
                              </div>
                            </th>
                          ))}
                          <th className="px-3 py-2.5 text-center font-bold sticky right-0 bg-indigo-800 z-20 min-w-[90px]">
                            합계
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {studentList.map((student, sIdx) => {
                          const isDropped = student.isDroppedOut
                          const totalForUnit = Object.values(unitDetailData.minutesPerDate).reduce((a, b) => a + b, 0)
                          const totalAttended = unitDetailData.dates.reduce((sum, date) => {
                            return sum + (unitDetailData.rows[student.name]?.[date]?.attended ?? 0)
                          }, 0)

                          return (
                            <tr key={sIdx} className={isDropped ? 'bg-slate-100 opacity-60' : 'hover:bg-indigo-50 transition-colors'}>
                              <td className={`px-4 py-2.5 font-bold sticky left-0 z-10 border-r border-slate-200 ${isDropped ? 'bg-slate-100' : 'bg-white'}`}>
                                {student.name}
                              </td>

                              {unitDetailData.dates.map(date => {
                                const day = unitDetailData.rows[student.name]?.[date] ?? null
                                const dayTotal = unitDetailData.minutesPerDate[date]

                                if (isDropped) {
                                  return <td key={date} className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-200">—</td>
                                }

                                // 기록 없음 = 결석
                                if (!day) {
                                  return (
                                    <td key={date} className="px-3 py-2.5 text-center border-r border-slate-200 bg-rose-50">
                                      <span className="text-rose-500 font-bold">결석</span>
                                    </td>
                                  )
                                }

                                // 정상 출석 (지각/결석/외출/조퇴 제외한 모든 상태)
                                if (day.isFullCredit) {
                                  const isRegular = !day.status || day.status === '출석'
                                  return isRegular ? (
                                    // 일반 출석 → O
                                    <td key={date} className="px-3 py-2.5 text-center border-r border-slate-200 bg-emerald-50">
                                      <div className="text-emerald-600 font-bold text-base">O</div>
                                    </td>
                                  ) : (
                                    // 공가/병가/승인/기타 등 → 사유 표시
                                    <td key={date} className="px-3 py-2.5 text-center border-r border-slate-200 bg-violet-50">
                                      <div className="text-violet-600 font-bold text-xs leading-tight">{day.status}</div>
                                      <div className="text-[9px] text-violet-400 mt-0.5">출석인정</div>
                                    </td>
                                  )
                                }

                                // 완전 출석 (지각/조퇴 등 부분 계산이었으나 결국 전일 채운 경우)
                                if (day.attended >= dayTotal) {
                                  return (
                                    <td key={date} className="px-3 py-2.5 text-center border-r border-slate-200 bg-emerald-50">
                                      <div className="text-emerald-600 font-bold text-base">O</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {day.checkIn && day.checkOut ? `${day.checkIn}~${day.checkOut}` : ''}
                                      </div>
                                    </td>
                                  )
                                }

                                // 부분 출석
                                if (day.attended > 0) {
                                  return (
                                    <td key={date} className="px-3 py-2.5 text-center border-r border-slate-200 bg-amber-50">
                                      <div className="text-amber-700 font-bold">{day.attended}/{dayTotal}분</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {day.checkIn && day.checkOut ? `${day.checkIn}~${day.checkOut}` : ''}
                                      </div>
                                    </td>
                                  )
                                }

                                // 기록은 있으나 0분 (해당 블록 시간에 없었음)
                                return (
                                  <td key={date} className="px-3 py-2.5 text-center border-r border-slate-200 bg-rose-50">
                                    <div className="text-rose-500 font-bold">{day.status || '결석'}</div>
                                    {day.checkIn && day.checkOut && (
                                      <div className="text-[10px] text-slate-400 mt-0.5">{day.checkIn}~{day.checkOut}</div>
                                    )}
                                  </td>
                                )
                              })}

                              {/* 합계 셀 */}
                              <td className={`px-3 py-2.5 text-center sticky right-0 z-10 font-bold border-l border-slate-300 ${
                                isDropped ? 'bg-slate-100 text-slate-400'
                                  : totalAttended >= totalForUnit ? 'bg-emerald-50 text-emerald-700'
                                  : totalAttended > 0 ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-600'
                              }`}>
                                {isDropped ? '—' : `${totalAttended}/${totalForUnit}분`}
                                {!isDropped && (
                                  <div className="text-[10px] font-normal mt-0.5">
                                    {((totalAttended / totalForUnit) * 100).toFixed(0)}%
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ──────────────────────────────────────────────────────────────────── */
        /* 개인별 분석 모드: 좌(4) + 우(8) 레이아웃                           */
        /* ──────────────────────────────────────────────────────────────────── */
        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 좌측 패널 */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* 과정 설정 */}
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-700">
                <BookOpen className="text-indigo-500" size={18} /> 과정 설정
              </h2>
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-xs text-slate-500 font-bold">과정명</label>
                  <input
                    type="text"
                    className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="과정명 입력"
                    value={activeConfig?.name || ''}
                    onChange={e => activeConfig && updateCourseConfig(activeConfig.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold">과목코드 (srchTrprId)</label>
                  <input
                    type="text"
                    className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="예: AIG20240000012345"
                    value={activeConfig?.courseCodeId || ''}
                    onChange={e => activeConfig && updateCourseConfig(activeConfig.id, { courseCodeId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold">회차</label>
                  <input
                    type="text"
                    className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="예: 1"
                    value={activeConfig?.round || ''}
                    onChange={e => activeConfig && updateCourseConfig(activeConfig.id, { round: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-bold">시작일 (YYYYMMDD)</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="20240101"
                      value={activeConfig?.startDate || ''}
                      onChange={e => activeConfig && updateCourseConfig(activeConfig.id, { startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold">종료일 (YYYYMMDD)</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="20241231"
                      value={activeConfig?.endDate || ''}
                      onChange={e => activeConfig && updateCourseConfig(activeConfig.id, { endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 시간표 업로드 */}
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-700">
                <Upload className="text-indigo-500" size={18} /> 시간표 업로드
              </h2>
              <input
                type="file"
                ref={scheduleInputRef}
                accept=".xlsx, .xls"
                onChange={handleScheduleUpload}
                className="hidden"
                id={`file-schedule-${activeCourseId}`}
              />
              <label
                htmlFor={`file-schedule-${activeCourseId}`}
                className="flex items-center justify-center gap-2 w-full p-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-600 hover:text-white transition-all font-bold text-sm"
              >
                <BookOpen size={16} /> 훈련일정 엑셀 업로드
              </label>
            </section>

            {/* 출결 (API 전용) */}
            <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-700">
                <Wifi className="text-emerald-500" size={18} /> HRD-Net 출결
              </h2>
              <button
                onClick={fetchAttendanceFromApi}
                disabled={activeRuntime.isLoadingAttendance}
                className="flex items-center justify-center gap-2 w-full p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all font-bold text-sm"
              >
                {activeRuntime.isLoadingAttendance ? (
                  <><RefreshCw size={16} className="animate-spin" /> 가져오는 중...</>
                ) : (
                  <><Wifi size={16} /> HRD-Net 가져오기</>
                )}
              </button>
              {activeRuntime.attendanceError && (
                <p className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
                  {activeRuntime.attendanceError}
                </p>
              )}

              {/* 업로드 파일 목록 */}
              {activeRuntime.uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-1">
                  {activeRuntime.uploadedFiles.map(f => (
                    <div key={f.id} className="text-[11px] flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className={`px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        f.type === '훈련일정' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {f.type}
                      </span>
                      <span className="truncate text-slate-600">{f.name}</span>
                      {f.date !== '-' && (
                        <span className="text-slate-400 ml-auto shrink-0">{f.date}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* NCS 단위 목록 */}
            {activeRuntime.schedule.length > 0 && (
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-700">
                  <Clock className="text-amber-500" size={18} /> NCS 단위 목록
                </h2>
                <div className="mb-3 p-3 bg-slate-900 text-white rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">전체 훈련 시간</p>
                  <p className="text-xl font-black text-amber-400">
                    {Math.floor(grandTotalMinutes / 60)}H {grandTotalMinutes % 60}M
                  </p>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px]">
                  {Object.entries(totalMinutesPerUnit).map(([unit, totalMin]) => (
                    <div key={unit} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                      <span className="truncate max-w-[65%] font-bold text-slate-700" title={unit}>{unit}</span>
                      <span className="font-bold text-slate-500 whitespace-nowrap">
                        {Math.floor(totalMin / 60)}H {totalMin % 60}M
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 학생 명단 */}
            {studentList.length > 0 && (
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-700">
                  <Users className="text-indigo-500" size={18} /> 학생 명단 ({studentList.length})
                </h2>
                <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                  {studentList.map(student => (
                    <button
                      key={student.name}
                      onClick={() => updateRuntime(activeCourseId, { selectedStudent: student.name })}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all ${
                        selectedStudent === student.name
                          ? 'bg-indigo-600 text-white shadow-md scale-[1.02]'
                          : student.isDroppedOut
                          ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-bold text-sm">{student.name}</span>
                      <div className="flex items-center gap-1">
                        {student.isDroppedOut && (
                          <span className="text-[10px] bg-slate-400 text-white px-1 rounded">탈락</span>
                        )}
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 우측 패널 */}
          <div className="lg:col-span-8 space-y-5">
            {/* 분석 가이드 */}
            <section className="bg-slate-800 text-white p-5 rounded-3xl shadow-lg">
              <h3 className="text-base font-bold flex items-center gap-2 mb-2">
                <ShieldCheck className="text-emerald-400" size={18} /> 분석 가이드
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
                <div>
                  <p>• <b>75% 이수 기준</b>: 75% 미만은 <span className="text-rose-400 font-bold">수료 위험군</span>으로 표시됩니다.</p>
                  <p>• <b>점심시간 제외</b>: 훈련 일정 내 점심 블록은 출석에서 자동 제외됩니다.</p>
                </div>
                <div>
                  <p>• <b>승인 처리</b>: 처리상태가 &apos;승인&apos;이고 증빙이 있으면 100% 인정됩니다.</p>
                  <p>• <b>탭 더블클릭</b>: 과정 탭 이름을 편집할 수 있습니다.</p>
                </div>
              </div>
            </section>

            {/* 개인별 분석 */}
            {!selectedStudent ? (
              <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-300">
                <User size={64} className="mb-6 opacity-10" />
                <h3 className="text-xl font-black">학생을 선택하여 상세 분석을 시작하세요</h3>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-bold">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-slate-800">
                    <p className="text-xs text-slate-400 uppercase">분석 과목</p>
                    <p className="text-3xl">{chartData.length}개</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-indigo-600">
                    <p className="text-xs text-slate-400 uppercase">총 인정 시간</p>
                    <p className="text-2xl text-indigo-600">
                      {Math.floor(Object.values(studentData[selectedStudent].attendanceByUnit).reduce((a, b) => a + b, 0) / 60)}H{' '}
                      {Object.values(studentData[selectedStudent].attendanceByUnit).reduce((a, b) => a + b, 0) % 60}M
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
                    <p className="text-xs text-slate-400 uppercase">평균 달성률</p>
                    <p className="text-2xl text-emerald-600">
                      {(chartData.reduce((acc, curr) => acc + curr.rate, 0) / (chartData.length || 1)).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-black text-slate-800 mb-6 border-l-4 border-indigo-600 pl-4">
                    {selectedStudent} 학생 성취도 분석
                  </h2>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis
                          dataKey="shortName"
                          type="category"
                          width={140}
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                        />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={24}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.rate >= 75 ? '#10b981' : '#f43f5e'} fillOpacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  )
}
