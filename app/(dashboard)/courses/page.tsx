import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format, isBefore, startOfDay } from 'date-fns'
import DeleteCourseButton from '@/components/courses/DeleteCourseButton'

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반',
  EMPLOYED: '재직자',
  UNEMPLOYED: '실업자',
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  KDT: 'KDT',
  INDUSTRY: '산대특',
}

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: rawCourses } = await supabase
    .from('courses')
    .select('*')
    .order('start_date', { ascending: true })

  // 정렬: 개강일 최신순, 종료된 과정은 하단으로
  const today = startOfDay(new Date())
  const courses = rawCourses?.sort((a, b) => {
    const aEnded = isBefore(new Date(a.end_date), today)
    const bEnded = isBefore(new Date(b.end_date), today)
    if (aEnded !== bEnded) return aEnded ? 1 : -1
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  }) || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">과정 관리</h2>
          <p className="text-muted-foreground">모든 과정을 조회하고 관리하세요</p>
        </div>
        <Link href="/courses/new">
          <Button>새 과정 추가</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>과정 목록</CardTitle>
          <CardDescription>
            총 {courses ? courses.length : 0}개의 과정이 등록되어 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
            <Table className="min-w-[1200px]" style={{ transform: 'rotateX(180deg)' }}>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">훈련ID</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[250px]">과정명</TableHead>
                  <TableHead className="whitespace-nowrap">강의장</TableHead>
                  <TableHead className="whitespace-nowrap">분야</TableHead>
                  <TableHead className="whitespace-nowrap">구분</TableHead>
                  <TableHead className="whitespace-nowrap">평일/주말</TableHead>
                  <TableHead className="whitespace-nowrap">강사</TableHead>
                  <TableHead className="whitespace-nowrap">기간</TableHead>
                  <TableHead className="whitespace-nowrap">시간</TableHead>
                  <TableHead className="whitespace-nowrap">정원</TableHead>
                  <TableHead className="whitespace-nowrap">훈련비</TableHead>
                  <TableHead className="whitespace-nowrap text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center">
                      등록된 과정이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  courses.map((course) => {
                    const ended = isBefore(new Date(course.end_date), today)
                    return (
                    <TableRow key={course.id} className={ended ? 'opacity-50' : ''}>
                      <TableCell className="font-medium whitespace-nowrap">{course.training_id}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.course_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.room_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.category || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{TYPE_LABEL[course.type] || course.type}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.is_weekend === 'WEEKEND' ? '주말' : '평일'}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.instructor || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(course.start_date), 'yyyy-MM-dd')} ~ {format(new Date(course.end_date), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{course.start_time} ~ {course.end_time}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.capacity || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.tuition ? course.tuition.toLocaleString() + '원' : '-'}</TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Link href={`/courses/${course.id}`}>
                          <Button variant="outline" size="sm">
                            보기
                          </Button>
                        </Link>
                        <Link href={`/courses/${course.id}/edit`}>
                          <Button variant="outline" size="sm">
                            수정
                          </Button>
                        </Link>
                        <DeleteCourseButton courseId={course.id} />
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
