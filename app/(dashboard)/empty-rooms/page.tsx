'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format, addDays, isToday, isBefore, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'

interface SlotInfo {
  occupied: boolean
  courseName?: string
  instructor?: string
  type?: string
}

interface TimeSlot {
  label: string
  start: string
  end: string
}

interface RoomData {
  date: string
  isWeekend: boolean
  rooms: string[]
  timeSlots: TimeSlot[]
  matrix: Record<string, Record<string, SlotInfo>>
}

// 시간대별 색상
const TIME_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '09:00': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  '10:00': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  '11:00': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  '12:00': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  '13:00': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  '14:00': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  '15:00': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  '16:00': { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  '17:00': { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  '18:00': { bg: 'bg-slate-200', text: 'text-slate-800', border: 'border-slate-400' },
  '19:00': { bg: 'bg-slate-200', text: 'text-slate-800', border: 'border-slate-400' },
  '20:00': { bg: 'bg-slate-200', text: 'text-slate-800', border: 'border-slate-400' },
  '21:00': { bg: 'bg-slate-200', text: 'text-slate-800', border: 'border-slate-400' },
}

const TYPE_BADGE: Record<string, string> = {
  GENERAL: 'bg-gray-200 text-gray-700',
  EMPLOYED: 'bg-blue-200 text-blue-700',
  UNEMPLOYED: 'bg-orange-200 text-orange-700',
  NATIONAL: 'bg-red-200 text-red-700',
  ASSESSMENT: 'bg-purple-200 text-purple-700',
  KDT: 'bg-cyan-200 text-cyan-700',
  INDUSTRY: 'bg-green-200 text-green-700',
}

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반',
  EMPLOYED: '재직자',
  UNEMPLOYED: '실업자',
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  KDT: 'KDT',
  INDUSTRY: '산대특',
}

export default function EmptyRoomsPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async (date: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/empty-rooms?date=${date}`)
      if (!res.ok) throw new Error('조회 실패')
      const json = await res.json()
      setData(json)
    } catch {
      setError('강의실 현황을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(selectedDate)
  }, [selectedDate, fetchData])

  // 오늘 포함 7일치 날짜 버튼
  const today = startOfDay(new Date())
  const dateButtons = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  // 통계
  const stats = data ? calculateStats(data) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">강의실 현황</h2>
        <p className="text-muted-foreground">날짜별 강의실 사용 현황을 한눈에 확인하세요</p>
      </div>

      {/* 날짜 선택 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dateButtons.map((d) => {
              const dateStr = format(d, 'yyyy-MM-dd')
              const isSelected = dateStr === selectedDate
              const dayOfWeek = d.getDay()
              const isSun = dayOfWeek === 0
              const isSat = dayOfWeek === 6
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex-shrink-0 px-4 py-3 rounded-lg border-2 text-center transition-all min-w-[80px]
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                    ${isToday(d) ? 'ring-2 ring-blue-300' : ''}
                  `}
                >
                  <div className={`text-xs font-medium ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-500'}`}>
                    {format(d, 'EEE', { locale: ko })}
                  </div>
                  <div className={`text-lg font-bold ${isSelected ? 'text-blue-700' : ''}`}>
                    {format(d, 'd')}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {format(d, 'M월')}
                  </div>
                  {isToday(d) && (
                    <div className="text-[10px] text-blue-500 font-semibold">오늘</div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 통계 요약 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">전체 강의실</p>
              <p className="text-3xl font-bold">{stats.totalRooms}개</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-green-600">종일 비어있음</p>
              <p className="text-3xl font-bold text-green-700">{stats.fullyEmpty}개</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-red-600">종일 사용 중</p>
              <p className="text-3xl font-bold text-red-700">{stats.fullyOccupied}개</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-yellow-600">부분 사용</p>
              <p className="text-3xl font-bold text-yellow-700">{stats.partiallyUsed}개</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 범례 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold">시간대 구분:</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-100 border border-blue-300" /> 오전 (09~12)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100 border border-amber-300" /> 점심 (12~13)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300" /> 오후 (13~16)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-violet-100 border border-violet-300" /> 저녁 (16~18)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-slate-200 border border-slate-400" /> 야간 (18~22)</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-white border-2 border-green-400" /> 빈 강의실</span>
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-4 rounded-md border border-red-200">{error}</div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>
      )}

      {/* 시간표 매트릭스 */}
      {data && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>
              {format(new Date(data.date + 'T00:00:00'), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
              {data.isWeekend && <span className="ml-2 text-sm font-normal text-blue-500">(주말)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white p-2 border text-sm font-semibold text-gray-600 w-[120px]">
                      시간 / 강의실
                    </th>
                    {data.rooms.map((room) => (
                      <th key={room} className="p-2 border text-center text-sm font-bold min-w-[100px]">
                        {room}호
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.timeSlots.map((slot) => {
                    const colors = TIME_COLORS[slot.start] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                    return (
                      <tr key={slot.start}>
                        <td className={`sticky left-0 z-10 p-2 border text-xs font-medium whitespace-nowrap ${colors.bg} ${colors.text}`}>
                          {slot.start}~{slot.end}
                        </td>
                        {data.rooms.map((room) => {
                          const info = data.matrix[room]?.[slot.start]
                          if (!info || !info.occupied) {
                            return (
                              <td key={room} className="p-2 border text-center bg-white border-green-200">
                                <span className="text-green-500 text-xs">-</span>
                              </td>
                            )
                          }
                          const typeBadge = TYPE_BADGE[info.type || ''] || 'bg-gray-200 text-gray-700'
                          const typeLabel = TYPE_LABEL[info.type || ''] || info.type
                          return (
                            <td
                              key={room}
                              className={`p-1.5 border ${colors.bg} ${colors.border}`}
                              title={`${info.courseName}\n강사: ${info.instructor || '-'}\n구분: ${typeLabel}`}
                            >
                              <div className="text-[11px] leading-tight">
                                <div className="font-semibold truncate max-w-[120px]">{info.courseName}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`px-1 rounded text-[10px] ${typeBadge}`}>{typeLabel}</span>
                                  {info.instructor && (
                                    <span className="text-[10px] text-gray-500 truncate">{info.instructor}</span>
                                  )}
                                </div>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function calculateStats(data: RoomData) {
  const totalRooms = data.rooms.length
  let fullyEmpty = 0
  let fullyOccupied = 0

  for (const room of data.rooms) {
    const slots = Object.values(data.matrix[room] || {})
    const occupiedCount = slots.filter((s) => s.occupied).length
    if (occupiedCount === 0) fullyEmpty++
    else if (occupiedCount === slots.length) fullyOccupied++
  }

  return {
    totalRooms,
    fullyEmpty,
    fullyOccupied,
    partiallyUsed: totalRooms - fullyEmpty - fullyOccupied,
  }
}
