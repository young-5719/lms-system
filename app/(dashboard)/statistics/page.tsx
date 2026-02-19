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

const COURSE_TYPE_LABELS: Record<string, string> = {
  GENERAL: '일반',
  EMPLOYED: '재직자',
  UNEMPLOYED: '실업자',
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  KDT: 'KDT',
  INDUSTRY: '산대특',
}

export default async function StatisticsPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('course_name, type, sub_category, capacity, current_students_gov, current_students_gen, recruitment_rate, completion_count, completion_rate, dropouts')

  // 구분별 통계 계산
  const statsByType: Record<string, any> = {}

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

      if (course.recruitment_rate != null && course.recruitment_rate > 0) {
        statsByType[type].totalRecruitmentRate += course.recruitment_rate
        statsByType[type].recruitmentRateCount++
      }

      if (course.completion_rate != null && course.completion_rate > 0) {
        statsByType[type].totalCompletionRate += course.completion_rate
        statsByType[type].completionRateCount++
      }
    })
  }

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

  const coursesWithRecruitment = courses?.filter(c => c.recruitment_rate != null && c.recruitment_rate > 0) || []
  const avgRecruitmentRate = coursesWithRecruitment.length > 0
    ? (coursesWithRecruitment.reduce((sum, c) => sum + c.recruitment_rate, 0) / coursesWithRecruitment.length).toFixed(1)
    : '-'

  const coursesWithCompletion = courses?.filter(c => c.completion_rate != null && c.completion_rate > 0) || []
  const avgCompletionRate = coursesWithCompletion.length > 0
    ? (coursesWithCompletion.reduce((sum, c) => sum + c.completion_rate, 0) / coursesWithCompletion.length).toFixed(1)
    : '-'

  // 소분류별 모집률 통계
  const statsBySubCategory: Record<string, { count: number; totalRate: number; rateCount: number }> = {}

  if (courses) {
    courses.forEach((course) => {
      const sub = course.sub_category || '미분류'
      if (!statsBySubCategory[sub]) {
        statsBySubCategory[sub] = { count: 0, totalRate: 0, rateCount: 0 }
      }
      statsBySubCategory[sub].count++
      if (course.recruitment_rate != null && course.recruitment_rate > 0) {
        statsBySubCategory[sub].totalRate += course.recruitment_rate
        statsBySubCategory[sub].rateCount++
      }
    })
  }

  const subCategoryStats = Object.entries(statsBySubCategory)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      avgRate: stats.rateCount > 0 ? stats.totalRate / stats.rateCount : 0,
      rateCount: stats.rateCount,
    }))
    .filter(s => s.rateCount > 0)
    .sort((a, b) => b.avgRate - a.avgRate)

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
            <div className="text-2xl font-bold">{avgRecruitmentRate === '-' ? '-' : `${avgRecruitmentRate}%`}</div>
            <p className="text-xs text-muted-foreground">{coursesWithRecruitment.length}개 과정 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 수료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCompletionRate === '-' ? '-' : `${avgCompletionRate}%`}</div>
            <p className="text-xs text-muted-foreground">{coursesWithCompletion.length}개 과정 기준</p>
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

      {/* 소분류별 평균 모집률 */}
      <Card>
        <CardHeader>
          <CardTitle>소분류별 평균 모집률</CardTitle>
          <CardDescription>소분류 기준 평균 모집률 순위</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>순위</TableHead>
                <TableHead>소분류</TableHead>
                <TableHead className="text-right">과정 수</TableHead>
                <TableHead className="text-right">평균 모집률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subCategoryStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    소분류 모집률 데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                subCategoryStats.map((stat, i) => (
                  <TableRow key={stat.name}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell className="font-medium">{stat.name}</TableCell>
                    <TableCell className="text-right">{stat.count}개</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${stat.avgRate >= 80 ? 'text-green-600' : stat.avgRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {stat.avgRate.toFixed(1)}%
                      </span>
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
                <TableHead>소분류</TableHead>
                <TableHead>구분</TableHead>
                <TableHead className="text-right">정원</TableHead>
                <TableHead className="text-right">수강생</TableHead>
                <TableHead className="text-right">모집률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses && courses
                .filter((c) => c.recruitment_rate != null && c.recruitment_rate > 0)
                .sort((a, b) => (b.recruitment_rate || 0) - (a.recruitment_rate || 0))
                .slice(0, 10)
                .map((course, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{course.course_name}</TableCell>
                    <TableCell>{course.sub_category || '-'}</TableCell>
                    <TableCell>{COURSE_TYPE_LABELS[course.type] || course.type}</TableCell>
                    <TableCell className="text-right">{course.capacity || '-'}명</TableCell>
                    <TableCell className="text-right">
                      {(course.current_students_gov || 0) + (course.current_students_gen || 0)}명
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {course.recruitment_rate}%
                    </TableCell>
                  </TableRow>
                ))}
              {(!courses || courses.filter((c) => c.recruitment_rate != null && c.recruitment_rate > 0).length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
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
