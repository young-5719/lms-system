'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

interface Course {
  course_name: string
  room_number: string
  type: string
  instructor: string | null
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  is_weekend: string
  category: string | null
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

const TYPE_BADGE: Record<string, string> = {
  GENERAL: 'bg-gray-100 text-gray-700',
  EMPLOYED: 'bg-blue-100 text-blue-700',
  UNEMPLOYED: 'bg-orange-100 text-orange-700',
  NATIONAL: 'bg-red-100 text-red-700',
  ASSESSMENT: 'bg-purple-100 text-purple-700',
  KDT: 'bg-cyan-100 text-cyan-700',
  INDUSTRY: 'bg-green-100 text-green-700',
}

export default function OngoingCoursesCard({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
        onClick={() => setOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">진행 중인 과정</CardTitle>
          <span className="text-xs text-blue-500">클릭하여 상세보기</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{courses.length}</div>
          <p className="text-xs text-muted-foreground mt-1">현재 진행 중</p>
        </CardContent>
      </Card>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] mx-4 flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold">진행 중인 과정</h3>
                <p className="text-sm text-muted-foreground mt-1">총 {courses.length}개 과정</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-md text-gray-500 hover:text-gray-700 text-xl"
              >
                &times;
              </button>
            </div>

            {/* 목록 */}
            <div className="overflow-y-auto flex-1 p-6">
              {courses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">진행 중인 과정이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {courses.map((course, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[course.type] || 'bg-gray-100 text-gray-700'}`}>
                              {TYPE_LABEL[course.type] || course.type}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                              {course.is_weekend === 'WEEKEND' ? '주말' : '평일'}
                            </span>
                            {course.category && (
                              <span className="text-xs text-gray-400">{course.category}</span>
                            )}
                          </div>
                          <h4 className="font-semibold mt-1.5 truncate">{course.course_name}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                            <span>강의실: <strong>{course.room_number}호</strong></span>
                            <span>강사: <strong>{course.instructor || '-'}</strong></span>
                            <span>시간: <strong>{course.start_time} ~ {course.end_time}</strong></span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500 whitespace-nowrap flex-shrink-0">
                          <div>{format(new Date(course.start_date), 'yy.MM.dd')}</div>
                          <div>~ {format(new Date(course.end_date), 'yy.MM.dd')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
