import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET - 모든 과정 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const roomNumber = searchParams.get('roomNumber')
    const type = searchParams.get('type')

    const where: any = {}
    if (roomNumber) where.roomNumber = roomNumber
    if (type) where.type = type

    const courses = await prisma.course.findMany({
      where,
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json(courses)
  } catch (error) {
    console.error('Error fetching courses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    )
  }
}

// POST - 새 과정 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // 날짜 문자열을 Date 객체로 변환
    const courseData = {
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      presentationDate: body.presentationDate ? new Date(body.presentationDate) : null,
      changeStartDate: body.changeStartDate ? new Date(body.changeStartDate) : null,
    }

    const course = await prisma.course.create({
      data: courseData,
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error) {
    console.error('Error creating course:', error)
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    )
  }
}
