import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALL_ROOMS = ['601호', '602호', '603호', '604호', '605호', '606호', '607호', '608호', '609호', '610호']

// POST - 빈 강의장 조회
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { date, startTime, endTime } = await request.json()

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'date, startTime, and endTime are required' },
        { status: 400 }
      )
    }

    const targetDate = date

    // 해당 날짜에 진행 중인 과정 조회
    const { data: occupiedCourses } = await supabase
      .from('courses')
      .select('room_number, change_room_number, start_time, end_time, day_type')
      .lte('start_date', targetDate)
      .gte('end_date', targetDate)

    // 요일 체크 (평일/주말 필터)
    const targetDateObj = new Date(targetDate)
    const dayOfWeek = targetDateObj.getDay() // 0: 일요일, 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // 시간이 겹치는 강의장 찾기
    const occupiedRooms = new Set<string>()

    if (occupiedCourses) {
      for (const course of occupiedCourses) {
        // 평일/주말 필터링
        if (course.day_type === 'WEEKDAY' && isWeekend) continue
        if (course.day_type === 'WEEKEND' && !isWeekend) continue

        // 실제 사용 중인 강의장 (변경된 강의장 우선)
        const actualRoom = course.change_room_number || course.room_number

        if (!actualRoom || !course.start_time || !course.end_time) continue

        // 시간 문자열을 분으로 변환 (예: "09:00" -> 540)
        const courseStart = timeToMinutes(course.start_time)
        const courseEnd = timeToMinutes(course.end_time)
        const targetStart = timeToMinutes(startTime)
        const targetEnd = timeToMinutes(endTime)

        // 시간이 겹치는지 확인
        const isOverlapping = !(courseEnd <= targetStart || courseStart >= targetEnd)

        if (isOverlapping) {
          occupiedRooms.add(actualRoom)
        }
      }
    }

    // 빈 강의장 찾기
    const emptyRooms = ALL_ROOMS.filter(room => !occupiedRooms.has(room))

    return NextResponse.json({
      date,
      startTime,
      endTime,
      emptyRooms,
      occupiedRooms: Array.from(occupiedRooms),
    })
  } catch (error) {
    console.error('Error finding empty rooms:', error)
    return NextResponse.json(
      { error: 'Failed to find empty rooms' },
      { status: 500 }
    )
  }
}

// Google Sheets 데이터 기반 빈 강의장 조회 (시간 정보 없음, 날짜만)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      )
    }

    // Google Sheets에서 데이터 가져오기
    const googleSheetsUrl = process.env.GOOGLE_SHEETS_API_URL

    if (!googleSheetsUrl || googleSheetsUrl === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
      // Google Sheets URL이 설정되지 않았으면 Supabase 기반으로 폴백
      const { data: occupiedCourses } = await supabase
        .from('courses')
        .select('room_number, change_room_number')
        .lte('start_date', date)
        .gte('end_date', date)

      const occupiedRooms = new Set<string>()
      if (occupiedCourses) {
        occupiedCourses.forEach(course => {
          const room = course.change_room_number || course.room_number
          if (room) occupiedRooms.add(room)
        })
      }

      const emptyRooms = ALL_ROOMS.filter(room => !occupiedRooms.has(room))

      return NextResponse.json({
        date,
        emptyRooms,
        occupiedRooms: Array.from(occupiedRooms),
        source: 'database',
      })
    }

    // Google Sheets에서 데이터 가져오기
    const response = await fetch(googleSheetsUrl)
    const data = await response.json()

    // 해당 날짜의 스케줄 찾기
    const dateSchedule = data.schedule.find((s: any) => s.date === date)

    if (!dateSchedule) {
      return NextResponse.json({
        date,
        emptyRooms: ALL_ROOMS,
        occupiedRooms: [],
        source: 'google-sheets',
      })
    }

    // 사용 중인 강의장
    const occupiedRooms = Object.keys(dateSchedule.rooms)

    // 빈 강의장
    const emptyRooms = ALL_ROOMS.filter(room => !occupiedRooms.includes(room))

    return NextResponse.json({
      date,
      emptyRooms,
      occupiedRooms,
      source: 'google-sheets',
    })
  } catch (error) {
    console.error('Error finding empty rooms:', error)
    return NextResponse.json(
      { error: 'Failed to find empty rooms' },
      { status: 500 }
    )
  }
}

// 시간 문자열을 분으로 변환하는 헬퍼 함수
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
