import Link from 'next/link'
import { prisma } from '@/lib/prisma'
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
import { format } from 'date-fns'
import DeleteCourseButton from '@/components/courses/DeleteCourseButton'

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
  })

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
            총 {courses.length}개의 과정이 등록되어 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>훈련ID</TableHead>
                  <TableHead>과정명</TableHead>
                  <TableHead>강의장</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>강사</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>모집률</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      등록된 과정이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.trainingId}</TableCell>
                      <TableCell>{course.courseName}</TableCell>
                      <TableCell>{course.roomNumber}</TableCell>
                      <TableCell>{course.type}</TableCell>
                      <TableCell>{course.instructor || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(course.startDate), 'yyyy-MM-dd')} ~ {format(new Date(course.endDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>{course.recruitmentRate ? `${course.recruitmentRate}%` : '-'}</TableCell>
                      <TableCell className="text-right space-x-2">
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
