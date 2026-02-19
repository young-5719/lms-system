'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface RoomCourse {
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

interface RoomData {
  room: string
  courses: RoomCourse[]
}

const TYPE_STYLE: Record<string, string> = {
  NATIONAL: 'bg-red-600 text-white',
  EMPLOYED: 'bg-blue-600 text-white',
  UNEMPLOYED: 'bg-amber-500 text-white',
  GENERAL: 'bg-gray-500 text-white',
  KDT: 'bg-cyan-600 text-white',
  ASSESSMENT: 'bg-purple-600 text-white',
  INDUSTRY: 'bg-green-600 text-white',
}

// 과정 수에 따른 인쇄 사이즈 클래스
function getPrintSize(totalCourses: number) {
  if (totalCourses <= 4) {
    return { header: 'print-text-base', cell: 'print-text-base', cellPy: 'print-py-6', headerTitle: 'print-text-4xl' }
  }
  if (totalCourses <= 6) {
    return { header: 'print-text-sm-plus', cell: 'print-text-sm-plus', cellPy: 'print-py-4', headerTitle: 'print-text-3xl' }
  }
  // 7~8개
  return { header: 'print-text-sm', cell: 'print-text-sm', cellPy: 'print-py-3', headerTitle: 'print-text-3xl' }
}

export default function RoomSchedulePrint({ rooms }: { rooms: RoomData[] }) {
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(
    new Set(rooms.map(r => r.room))
  )

  const toggleRoom = (room: string) => {
    setSelectedRooms(prev => {
      const next = new Set(prev)
      if (next.has(room)) next.delete(room)
      else next.add(room)
      return next
    })
  }

  const selectAll = () => setSelectedRooms(new Set(rooms.map(r => r.room)))
  const selectNone = () => setSelectedRooms(new Set())
  const handlePrint = () => window.print()

  const filteredRooms = rooms.filter(r => selectedRooms.has(r.room))

  return (
    <div>
      {/* 화면용 컨트롤 */}
      <div className="no-print space-y-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">강의장 시간표</h2>
          <p className="text-muted-foreground">강의실 운영판 출력용</p>
        </div>

        <div className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">출력할 강의장 선택</span>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={selectAll}>전체 선택</Button>
              <Button variant="outline" size="sm" onClick={selectNone}>전체 해제</Button>
              <Button onClick={handlePrint} className="ml-4">인쇄하기</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {rooms.map(r => (
              <label key={r.room} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedRooms.has(r.room)}
                  onCheckedChange={() => toggleRoom(r.room)}
                />
                <span className="text-sm">
                  {r.room}호
                  <span className="text-muted-foreground ml-1">({r.courses.length})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 강의장별 시간표 */}
      {filteredRooms.map((roomData) => {
        const weekdayCourses = roomData.courses.filter(c => c.isWeekend !== 'WEEKEND')
        const weekendCourses = roomData.courses.filter(c => c.isWeekend === 'WEEKEND')
        const totalCourses = roomData.courses.length
        const sz = getPrintSize(totalCourses)

        return (
          <div key={roomData.room} className="room-schedule-page mb-8">
            <div className="bg-white rounded-lg border-2 border-gray-800 overflow-hidden print:rounded-none print:border-3">
              {/* 헤더 */}
              <div className={`bg-gray-900 text-white px-6 py-5 text-center print:py-5`}>
                <h3 className={`text-3xl font-black tracking-wider ${sz.headerTitle}`}>
                  {roomData.room}호 강의실
                </h3>
              </div>

              <div className="p-5 print:p-5">
                {roomData.courses.length === 0 ? (
                  <div className="py-16 text-center text-gray-300 text-xl font-medium print:text-2xl print:py-32">
                    현재 진행 중인 과정이 없습니다
                  </div>
                ) : (
                  <div className="space-y-0">
                    {/* 평일반 */}
                    {weekdayCourses.length > 0 && (
                      <div>
                        <table className="w-full border-collapse print:table-fixed">
                          <colgroup className="print-only-colgroup">
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '36%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '12%' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>구분</th>
                              <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-left text-sm font-bold ${sz.header}`}>과정명</th>
                              <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>훈련기간</th>
                              <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>요일</th>
                              <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>수업시간</th>
                              <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>강사</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weekdayCourses.map((course, idx) => (
                              <CourseRow key={idx} course={course} sz={sz} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 주말반 구분선 */}
                    {weekdayCourses.length > 0 && weekendCourses.length > 0 && (
                      <div className="flex items-center my-3 print:my-4">
                        <div className="flex-1 border-t-[3px] border-dashed border-red-400" />
                        <span className="px-4 text-base font-black text-red-600 print:text-lg">주말반</span>
                        <div className="flex-1 border-t-[3px] border-dashed border-red-400" />
                      </div>
                    )}

                    {/* 주말반 */}
                    {weekendCourses.length > 0 && (
                      <div>
                        {weekdayCourses.length === 0 && (
                          <div className="flex items-center mb-3 print:mb-4">
                            <div className="flex-1 border-t-[3px] border-dashed border-red-400" />
                            <span className="px-4 text-base font-black text-red-600 print:text-lg">주말반</span>
                            <div className="flex-1 border-t-[3px] border-dashed border-red-400" />
                          </div>
                        )}
                        <table className="w-full border-collapse print:table-fixed">
                          <colgroup>
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '36%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '12%' }} />
                          </colgroup>
                          {weekdayCourses.length === 0 && (
                            <thead>
                              <tr>
                                <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>구분</th>
                                <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-left text-sm font-bold ${sz.header}`}>과정명</th>
                                <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>훈련기간</th>
                                <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>요일</th>
                                <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>수업시간</th>
                                <th className={`border-2 border-gray-800 bg-gray-100 px-3 py-3 text-center text-sm font-bold ${sz.header}`}>강사</th>
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {weekendCourses.map((course, idx) => (
                              <CourseRow key={idx} course={course} isWeekendRow sz={sz} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CourseRow({ course, isWeekendRow, sz }: { course: RoomCourse; isWeekendRow?: boolean; sz: ReturnType<typeof getPrintSize> }) {
  const typeStyle = TYPE_STYLE[course.type] || TYPE_STYLE.GENERAL

  return (
    <tr className={course.isUpcoming ? 'bg-yellow-50' : ''}>
      <td className={`border-2 border-gray-800 px-2 py-3 text-center ${sz.cellPy}`}>
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${typeStyle} ${sz.cell}`}>
          {course.typeLabel}
        </span>
      </td>
      <td className={`border-2 border-gray-800 px-3 py-3 ${sz.cellPy}`}>
        <div className={`font-semibold text-sm leading-snug ${sz.cell}`}>
          {course.courseName}
        </div>
        {course.isUpcoming && (
          <span className="inline-block mt-0.5 text-xs font-bold text-orange-600">
            ※ 개강예정
          </span>
        )}
      </td>
      <td className={`border-2 border-gray-800 px-2 py-3 text-center ${sz.cellPy}`}>
        <div className={`text-sm font-medium ${sz.cell}`}>{course.startDate}</div>
        <div className={`text-sm text-gray-500 ${sz.cell}`}>~ {course.endDate}</div>
      </td>
      <td className={`border-2 border-gray-800 px-2 py-3 text-center text-sm font-bold ${sz.cellPy} ${sz.cell} ${isWeekendRow ? 'text-red-600' : 'text-gray-800'}`}>
        {course.dayOfWeek}
      </td>
      <td className={`border-2 border-gray-800 px-2 py-3 text-center ${sz.cellPy}`}>
        <span className={`text-sm font-semibold ${sz.cell}`}>
          {course.startTime} ~ {course.endTime}
        </span>
      </td>
      <td className={`border-2 border-gray-800 px-2 py-3 text-center text-sm font-semibold ${sz.cellPy} ${sz.cell}`}>
        {course.instructor}
      </td>
    </tr>
  )
}
