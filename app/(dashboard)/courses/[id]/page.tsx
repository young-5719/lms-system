import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await prisma.course.findUnique({
    where: { id: parseInt(id) },
  })

  if (!course) {
    notFound()
  }

  const COURSE_TYPE_LABELS: Record<string, string> = {
    GENERAL: '일반',
    EMPLOYED: '재직자',
    UNEMPLOYED: '실업자',
    NATIONAL: '국기',
    ASSESSMENT: '과평',
    KDT: 'KDT',
    INDUSTRY: '산대특',
  }

  const DAY_TYPE_LABELS: Record<string, string> = {
    WEEKDAY: '평일',
    WEEKEND: '주말',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{course.courseName}</h2>
          <p className="text-muted-foreground">훈련ID: {course.trainingId}</p>
        </div>
        <div className="space-x-2">
          <Link href={`/courses/${course.id}/edit`}>
            <Button>수정</Button>
          </Link>
          <Link href="/courses">
            <Button variant="outline">목록</Button>
          </Link>
        </div>
      </div>

      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">훈련과정ID</p>
            <p className="text-base">{course.courseCodeId}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">NCS 코드</p>
            <p className="text-base">{course.ncsCode || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">회차</p>
            <p className="text-base">{course.round || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">분야</p>
            <p className="text-base">{course.category || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">구분</p>
            <p className="text-base">{COURSE_TYPE_LABELS[course.type]}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">소분류</p>
            <p className="text-base">{course.subCategory || '-'}</p>
          </div>
        </CardContent>
      </Card>

      {/* 일정 및 장소 */}
      <Card>
        <CardHeader>
          <CardTitle>일정 및 장소</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">평일/주말</p>
            <p className="text-base">{DAY_TYPE_LABELS[course.isWeekend]}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">강의장</p>
            <p className="text-base">{course.roomNumber}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">개강일</p>
            <p className="text-base">{format(new Date(course.startDate), 'yyyy-MM-dd')}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">종강일</p>
            <p className="text-base">{format(new Date(course.endDate), 'yyyy-MM-dd')}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">훈련일수</p>
            <p className="text-base">{course.trainingDays || '-'}일</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">요일</p>
            <p className="text-base">{course.dayOfWeek || '-'}</p>
          </div>
        </CardContent>
      </Card>

      {/* 시간 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>시간 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">시작시간</p>
            <p className="text-base">{course.startTime}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">종료시간</p>
            <p className="text-base">{course.endTime}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">일일시간</p>
            <p className="text-base">{course.dailyHours || '-'}시간</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">총시간</p>
            <p className="text-base">{course.totalHours || '-'}시간</p>
          </div>
        </CardContent>
      </Card>

      {/* 인원 및 비용 */}
      <Card>
        <CardHeader>
          <CardTitle>인원 및 비용</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">강사명</p>
            <p className="text-base">{course.instructor || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">취업실장</p>
            <p className="text-base">{course.employmentManager || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">정원</p>
            <p className="text-base">{course.capacity || '-'}명</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">훈련비</p>
            <p className="text-base">{course.tuition?.toLocaleString() || '-'}원</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">모집률</p>
            <p className="text-base">{course.recruitmentRate || '-'}%</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">수료율</p>
            <p className="text-base">{course.completionRate || '-'}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
