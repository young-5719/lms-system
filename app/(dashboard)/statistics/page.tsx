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

const TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반',
  EMPLOYED: '재직자',
  UNEMPLOYED: '실업자',
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  KDT: 'KDT',
  INDUSTRY: '산대특',
}

// 구분 표시 순서
const TYPE_ORDER = ['EMPLOYED', 'UNEMPLOYED', 'NATIONAL', 'GENERAL', 'ASSESSMENT', 'KDT', 'INDUSTRY']

export default async function StatisticsPage() {
  const supabase = await createClient()

  // col5=type, col17=capacity, col46≈current_students_gov+gen, col53=completion_count
  const { data: courses } = await supabase
    .from('courses')
    .select('course_name, type, sub_category, capacity, current_students_gov, current_students_gen, completion_count')

  // ── 구분별 통계 ────────────────────────────────────────────────
  const byType: Record<string, {
    count: number
    totalCapacity: number       // col17 합계
    totalStudents: number       // col46 합계 (gov+gen)
    completionRateSum: number   // 과정별 수료율 합산
    completionRateCount: number // 수료율 계산 가능 과정 수
  }> = {}

  if (courses) {
    for (const c of courses) {
      const type = c.type || 'GENERAL'
      if (!byType[type]) {
        byType[type] = {
          count: 0,
          totalCapacity: 0,
          totalStudents: 0,
          completionRateSum: 0,
          completionRateCount: 0,
        }
      }

      const capacity = c.capacity || 0
      // col46 = 총 수강생 (국비 + 일반)
      const students = (c.current_students_gov || 0) + (c.current_students_gen || 0)
      // col53 = 수료인원
      const completed = c.completion_count || 0

      byType[type].count++
      byType[type].totalCapacity += capacity
      byType[type].totalStudents += students

      // 평균 수료율: 수료인원(col53) / 수강생(col46) × 100
      if (students > 0 && completed > 0) {
        byType[type].completionRateSum += (completed / students) * 100
        byType[type].completionRateCount++
      }
    }
  }

  const statsArray = TYPE_ORDER
    .filter(type => byType[type])
    .map(type => {
      const s = byType[type]
      // 모집률 = 총 수강생(col46) / 총 정원(col17) × 100
      const recruitmentRate = s.totalCapacity > 0
        ? (s.totalStudents / s.totalCapacity) * 100
        : null
      const avgCompletionRate = s.completionRateCount > 0
        ? s.completionRateSum / s.completionRateCount
        : null

      return {
        type,
        typeLabel: TYPE_LABEL[type] || type,
        count: s.count,
        totalCapacity: s.totalCapacity,
        totalStudents: s.totalStudents,
        recruitmentRate,
        avgCompletionRate,
      }
    })

  // ── 전체 합계 ────────────────────────────────────────────────
  const totalCourses = courses?.length ?? 0
  const totalCapacity = statsArray.reduce((s, r) => s + r.totalCapacity, 0)
  const totalStudents = statsArray.reduce((s, r) => s + r.totalStudents, 0)
  const overallRecruitmentRate = totalCapacity > 0
    ? (totalStudents / totalCapacity) * 100
    : null

  const completedCoursesForRate = courses?.filter(c => {
    const students = (c.current_students_gov || 0) + (c.current_students_gen || 0)
    return students > 0 && (c.completion_count || 0) > 0
  }) ?? []
  const overallAvgCompletionRate = completedCoursesForRate.length > 0
    ? completedCoursesForRate.reduce((sum, c) => {
        const students = (c.current_students_gov || 0) + (c.current_students_gen || 0)
        return sum + ((c.completion_count || 0) / students) * 100
      }, 0) / completedCoursesForRate.length
    : null

  // ── 소분류별 모집률 ──────────────────────────────────────────
  const bySub: Record<string, { count: number; totalCapacity: number; totalStudents: number }> = {}
  if (courses) {
    for (const c of courses) {
      const sub = c.sub_category || '미분류'
      if (!bySub[sub]) bySub[sub] = { count: 0, totalCapacity: 0, totalStudents: 0 }
      bySub[sub].count++
      bySub[sub].totalCapacity += c.capacity || 0
      bySub[sub].totalStudents += (c.current_students_gov || 0) + (c.current_students_gen || 0)
    }
  }

  const subStats = Object.entries(bySub)
    .map(([name, s]) => ({
      name,
      count: s.count,
      totalCapacity: s.totalCapacity,
      totalStudents: s.totalStudents,
      recruitmentRate: s.totalCapacity > 0 ? (s.totalStudents / s.totalCapacity) * 100 : 0,
    }))
    .filter(s => s.totalCapacity > 0)
    .sort((a, b) => b.recruitmentRate - a.recruitmentRate)

  // ── 모집률 상위 과정 (상위 10개) ─────────────────────────────
  const topCourses = (courses ?? [])
    .filter(c => (c.capacity || 0) > 0)
    .map(c => {
      const students = (c.current_students_gov || 0) + (c.current_students_gen || 0)
      return {
        name: c.course_name,
        subCategory: c.sub_category,
        type: c.type,
        capacity: c.capacity || 0,
        students,
        recruitmentRate: ((students / (c.capacity || 1)) * 100),
      }
    })
    .filter(c => c.students > 0)
    .sort((a, b) => b.recruitmentRate - a.recruitmentRate)
    .slice(0, 10)

  const fmt = (n: number | null) => n != null ? n.toFixed(1) + '%' : '-'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">통계</h2>
        <p className="text-muted-foreground">
          구분별 총정원(col17) · 총수강생(col46) · 수료인원(col53) 기준으로 계산
        </p>
      </div>

      {/* 전체 통계 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">전체 과정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCourses}개</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 정원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacity.toLocaleString()}명</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 수강생</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents.toLocaleString()}명</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">전체 모집률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overallRecruitmentRate != null && overallRecruitmentRate >= 80 ? 'text-green-600' : overallRecruitmentRate != null && overallRecruitmentRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {fmt(overallRecruitmentRate)}
            </div>
            <p className="text-xs text-muted-foreground">수강생 / 정원</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">평균 수료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overallAvgCompletionRate != null && overallAvgCompletionRate >= 80 ? 'text-green-600' : overallAvgCompletionRate != null && overallAvgCompletionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {fmt(overallAvgCompletionRate)}
            </div>
            <p className="text-xs text-muted-foreground">수료인원 / 수강생</p>
          </CardContent>
        </Card>
      </div>

      {/* 구분별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>구분별 통계</CardTitle>
          <CardDescription>
            모집률 = 총수강생 ÷ 총정원 × 100 &nbsp;|&nbsp; 평균 수료율 = 수료인원 ÷ 수강생 × 100 (과정별 평균)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                <TableHead className="text-right">과정 수</TableHead>
                <TableHead className="text-right">총 정원</TableHead>
                <TableHead className="text-right">총 수강생</TableHead>
                <TableHead className="text-right">모집률</TableHead>
                <TableHead className="text-right">평균 수료율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statsArray.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    통계 데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {statsArray.map((s) => (
                    <TableRow key={s.type}>
                      <TableCell className="font-medium">{s.typeLabel}</TableCell>
                      <TableCell className="text-right">{s.count}개</TableCell>
                      <TableCell className="text-right">{s.totalCapacity.toLocaleString()}명</TableCell>
                      <TableCell className="text-right">{s.totalStudents.toLocaleString()}명</TableCell>
                      <TableCell className="text-right">
                        <span className={
                          s.recruitmentRate == null ? 'text-muted-foreground' :
                          s.recruitmentRate >= 80 ? 'font-semibold text-green-600' :
                          s.recruitmentRate >= 50 ? 'font-semibold text-yellow-600' :
                          'font-semibold text-red-600'
                        }>
                          {fmt(s.recruitmentRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          s.avgCompletionRate == null ? 'text-muted-foreground' :
                          s.avgCompletionRate >= 80 ? 'font-semibold text-green-600' :
                          s.avgCompletionRate >= 50 ? 'font-semibold text-yellow-600' :
                          'font-semibold text-red-600'
                        }>
                          {fmt(s.avgCompletionRate)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* 합계 행 */}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell>합계</TableCell>
                    <TableCell className="text-right">{totalCourses}개</TableCell>
                    <TableCell className="text-right">{totalCapacity.toLocaleString()}명</TableCell>
                    <TableCell className="text-right">{totalStudents.toLocaleString()}명</TableCell>
                    <TableCell className="text-right">{fmt(overallRecruitmentRate)}</TableCell>
                    <TableCell className="text-right">{fmt(overallAvgCompletionRate)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 소분류별 모집률 */}
      <Card>
        <CardHeader>
          <CardTitle>소분류별 모집률</CardTitle>
          <CardDescription>소분류 기준 모집률 순위 (총수강생 ÷ 총정원)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>순위</TableHead>
                <TableHead>소분류</TableHead>
                <TableHead className="text-right">과정 수</TableHead>
                <TableHead className="text-right">총 정원</TableHead>
                <TableHead className="text-right">총 수강생</TableHead>
                <TableHead className="text-right">모집률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                subStats.map((s, i) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.count}개</TableCell>
                    <TableCell className="text-right">{s.totalCapacity.toLocaleString()}명</TableCell>
                    <TableCell className="text-right">{s.totalStudents.toLocaleString()}명</TableCell>
                    <TableCell className="text-right">
                      <span className={
                        s.recruitmentRate >= 80 ? 'font-bold text-green-600' :
                        s.recruitmentRate >= 50 ? 'font-bold text-yellow-600' :
                        'font-bold text-red-600'
                      }>
                        {s.recruitmentRate.toFixed(1)}%
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
          <CardDescription>수강생 ÷ 정원으로 계산한 상위 10개 과정</CardDescription>
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
              {topCourses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                topCourses.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.subCategory || '-'}</TableCell>
                    <TableCell>{TYPE_LABEL[c.type] || c.type}</TableCell>
                    <TableCell className="text-right">{c.capacity}명</TableCell>
                    <TableCell className="text-right">{c.students}명</TableCell>
                    <TableCell className="text-right">
                      <span className={
                        c.recruitmentRate >= 80 ? 'font-bold text-green-600' :
                        c.recruitmentRate >= 50 ? 'font-bold text-yellow-600' :
                        'font-bold text-red-600'
                      }>
                        {c.recruitmentRate.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
