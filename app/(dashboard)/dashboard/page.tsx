import { prisma } from '@/lib/prisma'
import StatsCard from '@/components/dashboard/StatsCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const ROOMS = ['601호', '602호', '603호', '604호', '605호', '606호', '607호', '608호', '609호', '610호']

export default async function DashboardPage() {
  // 통계 데이터 조회
  const totalCourses = await prisma.course.count()

  const courses = await prisma.course.findMany({
    select: {
      recruitmentRate: true,
      completionRate: true,
      roomNumber: true,
      courseName: true,
      type: true,
      startDate: true,
      endDate: true,
      instructor: true,
    },
    orderBy: {
      startDate: 'desc'
    }
  })

  // 평균 모집률 계산
  const avgRecruitmentRate = courses.length > 0
    ? (courses.reduce((sum, c) => sum + (c.recruitmentRate || 0), 0) / courses.length).toFixed(1)
    : '0'

  // 평균 수료율 계산
  const avgCompletionRate = courses.length > 0
    ? (courses.reduce((sum, c) => sum + (c.completionRate || 0), 0) / courses.length).toFixed(1)
    : '0'

  // 진행 중인 과정
  const now = new Date()
  const ongoingCourses = courses.filter(c => c.startDate <= now && c.endDate >= now)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">학원 운영 현황을 한눈에 확인하세요</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="전체 과정"
          value={totalCourses}
          description="등록된 총 과정 수"
        />
        <StatsCard
          title="진행 중인 과정"
          value={ongoingCourses.length}
          description="현재 진행 중"
        />
        <StatsCard
          title="평균 모집률"
          value={`${avgRecruitmentRate}%`}
          description="전체 과정 평균"
        />
        <StatsCard
          title="평균 수료율"
          value={`${avgCompletionRate}%`}
          description="전체 과정 평균"
        />
      </div>

      {/* 강의장별 탭 */}
      <Card>
        <CardHeader>
          <CardTitle>강의장별 현황</CardTitle>
          <CardDescription>강의장을 선택하여 운영 중인 과정을 확인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-11">
              <TabsTrigger value="all">전체</TabsTrigger>
              {ROOMS.map((room) => (
                <TabsTrigger key={room} value={room}>
                  {room}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-4 text-left text-sm font-medium">과정명</th>
                        <th className="p-4 text-left text-sm font-medium">강의장</th>
                        <th className="p-4 text-left text-sm font-medium">구분</th>
                        <th className="p-4 text-left text-sm font-medium">강사</th>
                        <th className="p-4 text-left text-sm font-medium">기간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ongoingCourses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            진행 중인 과정이 없습니다
                          </td>
                        </tr>
                      ) : (
                        ongoingCourses.map((course, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-4 text-sm">{course.courseName}</td>
                            <td className="p-4 text-sm">{course.roomNumber}</td>
                            <td className="p-4 text-sm">{course.type}</td>
                            <td className="p-4 text-sm">{course.instructor || '-'}</td>
                            <td className="p-4 text-sm">
                              {format(new Date(course.startDate), 'yyyy-MM-dd')} ~ {format(new Date(course.endDate), 'yyyy-MM-dd')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {ROOMS.map((room) => {
              const roomCourses = ongoingCourses.filter(c => c.roomNumber === room)
              return (
                <TabsContent key={room} value={room} className="space-y-4">
                  <div className="rounded-md border">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-4 text-left text-sm font-medium">과정명</th>
                            <th className="p-4 text-left text-sm font-medium">구분</th>
                            <th className="p-4 text-left text-sm font-medium">강사</th>
                            <th className="p-4 text-left text-sm font-medium">기간</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomCourses.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                {room}에서 진행 중인 과정이 없습니다
                              </td>
                            </tr>
                          ) : (
                            roomCourses.map((course, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-4 text-sm">{course.courseName}</td>
                                <td className="p-4 text-sm">{course.type}</td>
                                <td className="p-4 text-sm">{course.instructor || '-'}</td>
                                <td className="p-4 text-sm">
                                  {format(new Date(course.startDate), 'yyyy-MM-dd')} ~ {format(new Date(course.endDate), 'yyyy-MM-dd')}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
