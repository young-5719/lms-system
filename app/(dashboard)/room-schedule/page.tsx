import { createClient } from '@/lib/supabase/server'
import { format, startOfDay, isAfter } from 'date-fns'
import RoomSchedulePrint from '@/components/room-schedule/RoomSchedulePrint'

const ALL_ROOMS = ['601', '602', '603', '604', '605', '606', '607', '608', '609', '610']

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반',
  EMPLOYED: '재직자',
  UNEMPLOYED: '실업자',
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  KDT: 'KDT',
  INDUSTRY: '산대특',
}

export interface RoomCourse {
  courseName: string
  type: string
  typeLabel: string
  startDate: string
  endDate: string
  dayOfWeek: string
  startTime: string
  endTime: string
  instructor: string
  isWeekend: string
  capacity: number | null
  isUpcoming: boolean
}

export interface RoomData {
  room: string
  courses: RoomCourse[]
}

export default async function RoomSchedulePage() {
  const supabase = await createClient()
  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')

  // 진행 중 + 개강예정 (종료일이 오늘 이후인 과정)
  const { data: courses } = await supabase
    .from('courses')
    .select('room_number, changed_room, change_start_date, course_name, type, start_date, end_date, day_of_week, start_time, end_time, instructor, is_weekend, capacity')
    .gte('end_date', todayStr)
    .order('start_time', { ascending: true })

  // 강의장별 그룹핑
  const roomMap = new Map<string, RoomCourse[]>()
  for (const room of ALL_ROOMS) {
    roomMap.set(room, [])
  }

  if (courses) {
    for (const c of courses) {
      let actualRoom = c.room_number || ''
      if (c.changed_room && c.change_start_date) {
        const changeDate = startOfDay(new Date(c.change_start_date))
        if (!isAfter(changeDate, today)) {
          actualRoom = c.changed_room
        }
      }

      if (!roomMap.has(actualRoom)) continue

      const courseStartDate = c.start_date ? startOfDay(new Date(c.start_date)) : today
      const isUpcoming = isAfter(courseStartDate, today)

      roomMap.get(actualRoom)!.push({
        courseName: c.course_name || '-',
        type: c.type || '',
        typeLabel: TYPE_LABEL[c.type] || c.type || '-',
        startDate: c.start_date ? format(new Date(c.start_date), 'yyyy.MM.dd') : '-',
        endDate: c.end_date ? format(new Date(c.end_date), 'yyyy.MM.dd') : '-',
        dayOfWeek: c.day_of_week || (c.is_weekend === 'WEEKEND' ? '토, 일' : '월~금'),
        startTime: c.start_time || '-',
        endTime: c.end_time || '-',
        instructor: c.instructor || '-',
        isWeekend: c.is_weekend || 'WEEKDAY',
        capacity: c.capacity,
        isUpcoming,
      })
    }
  }

  // 정렬: 평일반 먼저 → 주말반, 진행중 먼저 → 개강예정, 시간순
  for (const [, list] of roomMap) {
    list.sort((a, b) => {
      if (a.isWeekend !== b.isWeekend) return a.isWeekend === 'WEEKDAY' ? -1 : 1
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? 1 : -1
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }

  const roomDataList: RoomData[] = ALL_ROOMS.map(room => ({
    room,
    courses: roomMap.get(room) || [],
  }))

  return <RoomSchedulePrint rooms={roomDataList} />
}
