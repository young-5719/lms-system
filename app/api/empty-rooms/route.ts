import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    const targetDate = new Date(date)

    // 해당 날짜에 진행 중인 과정 조회
    const occupiedCourses = await prisma.course.findMany({
      where: {
        AND: [
          { startDate: { lte: targetDate } },
          { endDate: { gte: targetDate } },
        ],
      },
      select: {
        roomNumber: true,
        startTime: true,
        endTime: true,
      },
    })

    // 시간이 겹치는 강의장 찾기
    const occupiedRooms = new Set<string>()

    for (const course of occupiedCourses) {
      // 시간 문자열을 분으로 변환 (예: "09:00" -> 540)
      const courseStart = timeToMinutes(course.startTime)
      const courseEnd = timeToMinutes(course.endTime)
      const targetStart = timeToMinutes(startTime)
      const targetEnd = timeToMinutes(endTime)

      // 시간이 겹치는지 확인
      const isOverlapping = !(courseEnd <= targetStart || courseStart >= targetEnd)

      if (isOverlapping) {
        occupiedRooms.add(course.roomNumber)
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

// 시간 문자열을 분으로 변환하는 헬퍼 함수
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
