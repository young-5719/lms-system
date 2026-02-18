import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function StatisticsPage() {
  const supabase = await createClient()

  // 전체 과정 조회
  const { data: courses } = await supabase
    .from('courses')
    .select('course_name, type, capacity, current_students_gov, current_students_gen, recruitment_rate, completion_count, completion_rate, dropouts')

  // 구분별 통계 계산
  const statsByType: Record<string, any> = {}

  const COURSE_TYPE_LABELS: Record<string, string> = {
    GENERAL: '일반',
    EMPLOYED: '재직자',
    UNEMPLOYED: '실업자',
    NATIONAL: '국기',
    ASSESSMENT: '과평',
    KDT: 'KDT',
    INDUSTRY: '산대특',
  }

  if (courses) {
    courses.forEach((course) => {
      const type = course.type
      if (!statsByType[type]) {
        statsByType[type] = {
          count: 0,
          totalCapacity: 0,
          totalStudents: 0,
          totalRecruitmentRate: 0,
          totalCompletionRate: 0,
          recruitmentRateCount: 0,
          completionRateCount: 0,
        }
      }

      statsByType[type].count++
      statsByType[type].totalCapacity += course.capacity || 0
      statsByType[type].totalStudents += (course.current_students_gov || 0) + (course.current_students_gen || 0)

      if (course.recruitment_rate) {
        statsByType[type].totalRecruitmentRate += course.recruitment_rate
        statsByType[type].recruitmentRateCount++
      }

      if (course.completion_rate) {
        statsByType[type].totalCompletionRate += course.completion_rate
        statsByType[type].completionRateCount++
      }
    })
  }

  // 평균 계산
  const statsArray = Object.entries(statsByType).map(([type, stats]) => ({
    type: COURSE_TYPE_LABELS[type] || type,
    count: stats.count,
    totalCapacity: stats.totalCapacity,
    totalStudents: stats.totalStudents,
    avgRecruitmentRate: stats.recruitmentRateCount > 0
      ? (stats.totalRecruitmentRate / stats.recruitmentRateCount).toFixed(1)
      : '-',
    avgCompletionRate: stats.completionRateCount > 0
      ? (stats.totalCompletionRate / stats.completionRateCount).toFixed(1)
      : '-',
  }))

  // 전체 통계
  const totalCourses = courses ? courses.length : 0
  const totalCapacity = courses ? courses.reduce((sum, c) => sum + (c.capacity || 0), 0) : 0
  const totalStudents = courses ? courses.reduce((sum, c) => sum + (c.current_students_gov || 0) + (c.current_students_gen || 0), 0) : 0
  const avgRecruitmentRate = courses && courses.filter(c => c.recruitment_rate).length > 0
    ? (courses.reduce((sum, c) => sum + (c.recruitment_rate || 0), 0) / courses.filter(c => c.recruitment_rate).length).toFixed(1)
    : '0'
  const avgCompletionRate = courses && courses.filter(c => c.completion_rate).length > 0
    ? (courses.reduce((sum, c) => sum + (c.completion_rate || 0), 0) / courses.filter(c => c.completion_rate).length).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">통계</h2>
        <p className="text-muted-foreground">과정별 운영 통계를 확인하세요</p>
      </div>

      {/* 전체 통계 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 과정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCourses}개</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 정원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacity}명</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 수강생</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}명</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 모집률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRecruitmentRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 수료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCompletionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* 구분별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>구분별 통계</CardTitle>
          <CardDescription>과정 구분별 상세 통계</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                <TableHead className="text-right">과정 수</TableHead>
                <TableHead className="text-right">총 정원</TableHead>
                <TableHead className="text-right">총 수강생</TableHead>
                <TableHead className="text-right">평균 모집률</TableHead>
                <TableHead className="text-right">평균 수료율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsArray.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    통계 데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                statsArray.map((stat) => (
                  <TableRow key={stat.type}>
                    <TableCell className="font-medium">{stat.type}</TableCell>
                    <TableCell className="text-right">{stat.count}개</TableCell>
                    <TableCell className="text-right">{stat.totalCapacity}명</TableCell>
                    <TableCell className="text-right">{stat.totalStudents}명</TableCell>
                    <TableCell className="text-right">
                      {stat.avgRecruitmentRate !== '-' ? `${stat.avgRecruitmentRate}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.avgCompletionRate !== '-' ? `${stat.avgCompletionRate}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 모집률 상위 과정 */}
      <Card>
        <CardHeader>
          <CardTitle>모집률 상위 과정</CardTitle>
          <CardDescription>모집률이 높은 상위 10개 과정</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>과정명</TableHead>
                <TableHead>구분</TableHead>
                <TableHead className="text-right">정원</TableHead>
                <TableHead className="text-right">수강생</TableHead>
                <TableHead className="text-right">모집률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses && courses
                .filter((c) => c.recruitment_rate)
                .sort((a, b) => (b.recruitment_rate || 0) - (a.recruitment_rate || 0))
                .slice(0, 10)
                .map((course, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{course.course_name}</TableCell>
                    <TableCell>{COURSE_TYPE_LABELS[course.type]}</TableCell>
                    <TableCell className="text-right">{course.capacity || '-'}명</TableCell>
                    <TableCell className="text-right">
                      {(course.current_students_gov || 0) + (course.current_students_gen || 0)}명
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {course.recruitment_rate}%
                    </TableCell>
                  </TableRow>
                ))}
              {(!courses || courses.filter((c) => c.recruitment_rate).length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    모집률 데이터가 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
