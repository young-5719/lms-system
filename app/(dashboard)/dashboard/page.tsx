import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import Link from 'next/link'

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반', EMPLOYED: '재직자', UNEMPLOYED: '실업자',
  NATIONAL: '국기', ASSESSMENT: '과평', KDT: 'KDT', INDUSTRY: '산대특',
}

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']

function timeToMinutes(t: string) {
  const [h, m] = (t || '').split(':').map(Number)
  return h * 60 + (m || 0)
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('room_number, course_name, type, start_date, end_date, instructor, start_time, end_time, is_weekend, capacity, current_students_gov, current_students_gen')

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const dayOfWeek = now.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  const allCourses = courses ?? []
  const totalCourses = allCourses.length

  // 진행 중인 과정
  const ongoingCourses = allCourses.filter(c => c.start_date <= today && c.end_date >= today)
  const ongoingCount = ongoingCourses.length

  // 진행 중 구분별 카운트
  const ongoingByType: Record<string, number> = {}
  for (const c of ongoingCourses) {
    const t = c.type || 'GENERAL'
    ongoingByType[t] = (ongoingByType[t] || 0) + 1
  }

  // 2026년 모집률 (오늘 이전 개강 과정)
  const courses2026 = allCourses.filter(c => c.start_date >= '2026-01-01' && c.start_date <= today)
  const totalCapacity = courses2026.reduce((s, c) => s + (c.capacity || 0), 0)
  const totalStudents = courses2026.reduce((s, c) => s + (c.current_students_gov || 0) + (c.current_students_gen || 0), 0)
  const overallRate = totalCapacity > 0 ? (totalStudents / totalCapacity * 100).toFixed(1) : null

  // 오늘 19시 이후 강의실 현황
  const eveningOccupied = new Map<string, { courseName: string; instructor: string | null; type: string; startTime: string; endTime: string }>()
  for (const course of ongoingCourses) {
    if (course.is_weekend === 'WEEKDAY' && isWeekend) continue
    if (course.is_weekend === 'WEEKEND' && !isWeekend) continue
    const room = String(course.room_number || '').trim()
    if (!room || !course.end_time) continue
    if (timeToMinutes(course.end_time) <= timeToMinutes('19:00')) continue
    eveningOccupied.set(room, {
      courseName: course.course_name,
      instructor: course.instructor,
      type: course.type,
      startTime: course.start_time || '',
      endTime: course.end_time || '',
    })
  }
  const emptyRooms = ALL_ROOMS.filter(r => !eveningOccupied.has(r))
  const usedRooms = ALL_ROOMS.filter(r => eveningOccupied.has(r))

  // 강사 수 (2026년 과정)
  const instructorSet = new Set(
    allCourses
      .filter(c => c.start_date >= '2026-01-01' && c.start_date <= '2026-12-31')
      .map(c => (c.instructor || '').trim())
      .filter(i => i && i !== '-')
  )
  const instructorCount = instructorSet.size

  const rateColor = (r: string | null) =>
    r == null ? 'text-muted-foreground' :
    Number(r) >= 80 ? 'text-green-600' :
    Number(r) >= 50 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">
          {format(now, 'yyyy년 M월 d일')} {isWeekend ? '(주말)' : '(평일)'} 기준
        </p>
      </div>

      {/* 요약 통계 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 과정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCourses}</div>
            <p className="text-xs text-muted-foreground mt-1">등록된 총 과정</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">현재 진행 중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{ongoingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">오늘 기준 진행 과정</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">2026년 모집률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${rateColor(overallRate)}`}>
              {overallRate != null ? `${overallRate}%` : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">총수강생 ÷ 총정원</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">오늘 빈 강의실</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{emptyRooms.length}</div>
            <p className="text-xs text-muted-foreground mt-1">19시 이후 · {ALL_ROOMS.length}개 중</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 카테고리 1: 과정 운영 ─────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>📚</span> 과정 운영
        </h3>
        <div className="grid gap-4 md:grid-cols-2">

          <Link href="/courses" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-blue-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">📚</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-blue-600 transition-colors">과정 관리</CardTitle>
                      <CardDescription className="text-xs mt-0.5">전체 과정 목록 조회 및 관리</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-blue-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{totalCourses}</span>
                  <span className="text-sm text-muted-foreground">개 과정 등록됨</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(ongoingByType).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {TYPE_LABEL[type] || type} {count}
                    </Badge>
                  ))}
                  {ongoingCount > 0 && (
                    <span className="text-xs text-muted-foreground self-center">진행 중 {ongoingCount}개</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/attendance" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-violet-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-violet-600 transition-colors">출석부</CardTitle>
                      <CardDescription className="text-xs mt-0.5">과정별 수강생 출석 현황 관리</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-violet-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-violet-600">{ongoingCount}</span>
                  <span className="text-sm text-muted-foreground">개 과정 진행 중</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">과정을 선택하여 수강생 출석부를 확인하세요</p>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* ── 카테고리 2: 강의실 관리 ───────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>🏫</span> 강의실 관리
        </h3>
        <div className="grid gap-4 md:grid-cols-2">

          <Link href="/empty-rooms" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-green-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">🏫</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-green-600 transition-colors">빈 강의장</CardTitle>
                      <CardDescription className="text-xs mt-0.5">시간대별 빈 강의장 현황 조회</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-green-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-green-600">{emptyRooms.length}</span>
                  <span className="text-sm text-muted-foreground">개 사용 가능 (19시 이후)</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ALL_ROOMS.map(room => (
                    <span
                      key={room}
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        eveningOccupied.has(room)
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {room}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/room-schedule" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-amber-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">🗓️</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-amber-600 transition-colors">강의장 시간표</CardTitle>
                      <CardDescription className="text-xs mt-0.5">강의장별 전체 수업 시간표</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-amber-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-amber-600">{ALL_ROOMS.length}</span>
                  <span className="text-sm text-muted-foreground">개 강의실 시간표</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">날짜·강의실별 수업 배치 현황을 확인하세요</p>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* ── 카테고리 3: 분석 & 통계 ───────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2 border-b pb-2">
          <span>📊</span> 분석 & 통계
        </h3>
        <div className="grid gap-4 md:grid-cols-3">

          <Link href="/instructors" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-orange-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">👨‍🏫</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-orange-600 transition-colors">강사별 수업시간</CardTitle>
                      <CardDescription className="text-xs mt-0.5">월별 수업시간 집계 및 엑셀 내보내기</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-orange-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-orange-600">{instructorCount}</span>
                  <span className="text-sm text-muted-foreground">명 강사 (2026년)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">일정변경·취업특강 반영 집계</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/statistics" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-indigo-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">📈</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-indigo-600 transition-colors">통계</CardTitle>
                      <CardDescription className="text-xs mt-0.5">구분별 모집률·수료율 통계</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-indigo-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${rateColor(overallRate)}`}>
                    {overallRate != null ? `${overallRate}%` : '-'}
                  </span>
                  <span className="text-sm text-muted-foreground">전체 모집률</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">개강일 기준 조회 기간 설정 가능</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/competitors" className="group">
            <Card className="h-full hover:shadow-md transition-all border-2 hover:border-rose-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center text-2xl flex-shrink-0">🔍</div>
                    <div>
                      <CardTitle className="text-base group-hover:text-rose-600 transition-colors">경쟁기관</CardTitle>
                      <CardDescription className="text-xs mt-0.5">HRD-Net 기반 경쟁 학원 현황</CardDescription>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-rose-500 transition-colors text-lg">→</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">MBC아카데미 · 한국아이티 · 그린컴퓨터</p>
                <p className="text-xs text-muted-foreground mt-2">지역·개강일·훈련유형 필터 지원</p>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* 오늘 강의실 상세 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>오늘 19시 이후 강의실 현황</CardTitle>
            <CardDescription>
              {format(now, 'yyyy년 M월 d일')} {isWeekend ? '(주말)' : '(평일)'}
              &nbsp;· 사용 중 {usedRooms.length}개 / 빈 강의실 {emptyRooms.length}개
            </CardDescription>
          </div>
          <Link href="/empty-rooms">
            <span className="text-sm text-blue-500 hover:text-blue-700 hover:underline">상세보기 →</span>
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          {emptyRooms.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2">사용 가능 ({emptyRooms.length}개)</h4>
              <div className="flex flex-wrap gap-2">
                {emptyRooms.map(room => (
                  <div key={room} className="px-4 py-2 rounded-lg bg-green-50 border-2 border-green-300">
                    <p className="text-base font-bold text-green-700">{room}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {usedRooms.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-2">사용 중 ({usedRooms.length}개)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {usedRooms.map(room => {
                  const info = eveningOccupied.get(room)!
                  return (
                    <div key={room} className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
                      <div className="text-center bg-red-100 rounded-lg px-3 py-2 flex-shrink-0">
                        <p className="text-base font-bold text-red-700">{room}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{info.courseName}</p>
                        <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{TYPE_LABEL[info.type] || info.type}</span>
                          <span>|</span>
                          <span>{info.instructor || '-'}</span>
                          <span>|</span>
                          <span>{info.startTime}~{info.endTime}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {usedRooms.length === 0 && (
            <p className="text-sm text-muted-foreground">19시 이후 수업이 없습니다</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
