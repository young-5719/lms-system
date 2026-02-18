'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function EmptyRoomsPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/empty-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime,
          endTime
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || '빈 강의장 조회에 실패했습니다')
      }
    } catch (err) {
      setError('빈 강의장 조회 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">빈 강의장 조회</h2>
        <p className="text-muted-foreground">특정 날짜와 시간에 빈 강의장을 확인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>검색 조건</CardTitle>
          <CardDescription>날짜와 시간을 입력하여 빈 강의장을 찾으세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">날짜 *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">시작 시간 *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">종료 시간 *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? '검색 중...' : '빈 강의장 찾기'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* 검색 정보 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">검색 조건</p>
                  <p className="text-lg font-semibold">
                    {result.date} ({format(new Date(result.date + 'T00:00:00'), 'EEEE', { locale: ko })})
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    시간: {result.startTime} ~ {result.endTime}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">빈 강의장</p>
                  <p className="text-3xl font-bold text-green-600">
                    {result.emptyRooms.length}개
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 빈 강의장 */}
          <Card>
            <CardHeader>
              <CardTitle>빈 강의장</CardTitle>
              <CardDescription>
                해당 시간에 사용 가능한 강의장
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.emptyRooms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  해당 시간에 빈 강의장이 없습니다
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {result.emptyRooms.map((room: string) => (
                    <div
                      key={room}
                      className="p-6 border-2 rounded-lg text-center bg-green-50 border-green-300 hover:bg-green-100 transition-colors"
                    >
                      <p className="text-3xl font-bold text-green-700">{room}</p>
                      <p className="text-sm text-green-600 mt-2">사용 가능</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 사용 중인 강의장 */}
          <Card>
            <CardHeader>
              <CardTitle>사용 중인 강의장</CardTitle>
              <CardDescription>
                해당 시간에 예약되어 있는 강의장
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.occupiedRooms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  사용 중인 강의장이 없습니다
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {result.occupiedRooms.map((room: string) => (
                    <div
                      key={room}
                      className="p-6 border-2 rounded-lg text-center bg-red-50 border-red-300"
                    >
                      <p className="text-3xl font-bold text-red-700">{room}</p>
                      <p className="text-sm text-red-600 mt-2">사용 중</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
