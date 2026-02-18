'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROOMS = ['601호', '602호', '603호', '604호', '605호', '606호', '607호', '608호', '609호', '610호']
const COURSE_TYPES = ['GENERAL', 'EMPLOYED', 'UNEMPLOYED', 'NATIONAL', 'ASSESSMENT', 'KDT', 'INDUSTRY']
const COURSE_TYPE_LABELS: Record<string, string> = {
  GENERAL: '일반',
  EMPLOYED: '재직자',
  UNEMPLOYED: '실업자',
  NATIONAL: '국기',
  ASSESSMENT: '과평',
  KDT: 'KDT',
  INDUSTRY: '산대특',
}
const DAY_TYPES = ['WEEKDAY', 'WEEKEND']
const DAY_TYPE_LABELS: Record<string, string> = {
  WEEKDAY: '평일',
  WEEKEND: '주말',
}

interface CourseFormProps {
  initialData?: any
  mode: 'create' | 'edit'
}

export default function CourseForm({ initialData, mode }: CourseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    // 기본 정보
    trainingId: initialData?.trainingId || '',
    courseName: initialData?.courseName || '',
    courseCodeId: initialData?.courseCodeId || '',
    ncsCode: initialData?.ncsCode || '',
    round: initialData?.round || '',
    category: initialData?.category || '',
    type: initialData?.type || 'GENERAL',
    subCategory: initialData?.subCategory || '',
    detailCategory: initialData?.detailCategory || '',
    strategicField: initialData?.strategicField || '',

    // 일정 및 장소
    isWeekend: initialData?.isWeekend || 'WEEKDAY',
    roomNumber: initialData?.roomNumber || '601호',
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
    endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
    dayOfWeek: initialData?.dayOfWeek || '',
    trainingDays: initialData?.trainingDays || '',
    lectureDays: initialData?.lectureDays || '',
    holidays: initialData?.holidays || '',

    // 시간 정보
    startTime: initialData?.startTime || '09:00',
    endTime: initialData?.endTime || '18:00',
    dailyHours: initialData?.dailyHours || '',
    totalHours: initialData?.totalHours || '',
    lunchStart: initialData?.lunchStart || '12:00',
    lunchEnd: initialData?.lunchEnd || '13:00',

    // 인원 및 비용
    instructor: initialData?.instructor || '',
    employmentManager: initialData?.employmentManager || '',
    capacity: initialData?.capacity || '',
    tuition: initialData?.tuition || '',
    currentStudentsGov: initialData?.currentStudentsGov || '',
    currentStudentsGen: initialData?.currentStudentsGen || '',
    recruitmentRate: initialData?.recruitmentRate || '',
    dropouts: initialData?.dropouts || '',
    completionCount: initialData?.completionCount || '',
    completionRate: initialData?.completionRate || '',

    // 특강 및 행사
    specialLecture1: initialData?.specialLecture1 || '',
    specialLecture1Time: initialData?.specialLecture1Time || '',
    specialLecture2: initialData?.specialLecture2 || '',
    specialLecture2Time: initialData?.specialLecture2Time || '',
    presentationDate: initialData?.presentationDate ? new Date(initialData.presentationDate).toISOString().split('T')[0] : '',
    presentationTime: initialData?.presentationTime || '',

    // 운영 변동 사항
    changeStartDate: initialData?.changeStartDate ? new Date(initialData.changeStartDate).toISOString().split('T')[0] : '',
    changedRoom: initialData?.changedRoom || '',
    scheduleChange: initialData?.scheduleChange || '',
    operationNote: initialData?.operationNote || '',
  })

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 데이터 변환
      const submitData: any = {
        ...formData,
        trainingId: parseInt(formData.trainingId),
        round: formData.round ? parseInt(formData.round) : null,
        trainingDays: formData.trainingDays ? parseInt(formData.trainingDays) : null,
        dailyHours: formData.dailyHours ? parseFloat(formData.dailyHours) : null,
        totalHours: formData.totalHours ? parseFloat(formData.totalHours) : null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        tuition: formData.tuition ? parseInt(formData.tuition) : null,
        currentStudentsGov: formData.currentStudentsGov ? parseInt(formData.currentStudentsGov) : null,
        currentStudentsGen: formData.currentStudentsGen ? parseInt(formData.currentStudentsGen) : null,
        recruitmentRate: formData.recruitmentRate ? parseFloat(formData.recruitmentRate) : null,
        dropouts: formData.dropouts ? parseInt(formData.dropouts) : null,
        completionCount: formData.completionCount ? parseInt(formData.completionCount) : null,
        completionRate: formData.completionRate ? parseFloat(formData.completionRate) : null,
        specialLecture1Time: formData.specialLecture1Time ? parseFloat(formData.specialLecture1Time) : null,
        specialLecture2Time: formData.specialLecture2Time ? parseFloat(formData.specialLecture2Time) : null,
        presentationTime: formData.presentationTime ? parseFloat(formData.presentationTime) : null,
      }

      // 빈 문자열을 null로 변환
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          submitData[key] = null
        }
      })

      const url = mode === 'create' ? '/api/courses' : `/api/courses/${initialData.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        router.push('/courses')
        router.refresh()
      } else {
        setError('과정 저장에 실패했습니다')
      }
    } catch (err) {
      setError('과정 저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>과정의 기본 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="trainingId">훈련ID *</Label>
            <Input
              id="trainingId"
              type="number"
              value={formData.trainingId}
              onChange={(e) => handleChange('trainingId', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="courseName">과정명 *</Label>
            <Input
              id="courseName"
              value={formData.courseName}
              onChange={(e) => handleChange('courseName', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="courseCodeId">훈련과정ID *</Label>
            <Input
              id="courseCodeId"
              value={formData.courseCodeId}
              onChange={(e) => handleChange('courseCodeId', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ncsCode">NCS 코드</Label>
            <Input
              id="ncsCode"
              value={formData.ncsCode}
              onChange={(e) => handleChange('ncsCode', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="round">회차</Label>
            <Input
              id="round"
              type="number"
              value={formData.round}
              onChange={(e) => handleChange('round', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">분야</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">구분 *</Label>
            <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="구분 선택" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {COURSE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subCategory">소분류</Label>
            <Input
              id="subCategory"
              value={formData.subCategory}
              onChange={(e) => handleChange('subCategory', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="detailCategory">세분류</Label>
            <Input
              id="detailCategory"
              value={formData.detailCategory}
              onChange={(e) => handleChange('detailCategory', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="strategicField">국기직종</Label>
            <Input
              id="strategicField"
              value={formData.strategicField}
              onChange={(e) => handleChange('strategicField', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 일정 및 장소 */}
      <Card>
        <CardHeader>
          <CardTitle>일정 및 장소</CardTitle>
          <CardDescription>과정 일정과 강의장 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="isWeekend">평일/주말 *</Label>
            <Select value={formData.isWeekend} onValueChange={(value) => handleChange('isWeekend', value)}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {DAY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {DAY_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="roomNumber">강의장 *</Label>
            <Select value={formData.roomNumber} onValueChange={(value) => handleChange('roomNumber', value)}>
              <SelectTrigger>
                <SelectValue placeholder="강의장 선택" />
              </SelectTrigger>
              <SelectContent>
                {ROOMS.map((room) => (
                  <SelectItem key={room} value={room}>
                    {room}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">개강일 *</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">종강일 *</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">요일</Label>
            <Input
              id="dayOfWeek"
              value={formData.dayOfWeek}
              onChange={(e) => handleChange('dayOfWeek', e.target.value)}
              placeholder="예: 월수금"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainingDays">훈련일수</Label>
            <Input
              id="trainingDays"
              type="number"
              value={formData.trainingDays}
              onChange={(e) => handleChange('trainingDays', e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="lectureDays">수업 나오는 날</Label>
            <Textarea
              id="lectureDays"
              value={formData.lectureDays}
              onChange={(e) => handleChange('lectureDays', e.target.value)}
              placeholder="재직자/일반 상세 정보"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="holidays">휴강일</Label>
            <Textarea
              id="holidays"
              value={formData.holidays}
              onChange={(e) => handleChange('holidays', e.target.value)}
              placeholder="공휴일 제외"
            />
          </div>
        </CardContent>
      </Card>

      {/* 시간 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>시간 정보</CardTitle>
          <CardDescription>수업 시간 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startTime">시작시간 *</Label>
            <Input
              id="startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">종료시간 *</Label>
            <Input
              id="endTime"
              type="time"
              value={formData.endTime}
              onChange={(e) => handleChange('endTime', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dailyHours">일일시간</Label>
            <Input
              id="dailyHours"
              type="number"
              step="0.1"
              value={formData.dailyHours}
              onChange={(e) => handleChange('dailyHours', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalHours">총시간</Label>
            <Input
              id="totalHours"
              type="number"
              step="0.1"
              value={formData.totalHours}
              onChange={(e) => handleChange('totalHours', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lunchStart">점심시작</Label>
            <Input
              id="lunchStart"
              type="time"
              value={formData.lunchStart}
              onChange={(e) => handleChange('lunchStart', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lunchEnd">점심종료</Label>
            <Input
              id="lunchEnd"
              type="time"
              value={formData.lunchEnd}
              onChange={(e) => handleChange('lunchEnd', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 인원 및 비용 */}
      <Card>
        <CardHeader>
          <CardTitle>인원 및 비용</CardTitle>
          <CardDescription>강사, 인원, 비용 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="instructor">강사명</Label>
            <Input
              id="instructor"
              value={formData.instructor}
              onChange={(e) => handleChange('instructor', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employmentManager">취업실장</Label>
            <Input
              id="employmentManager"
              value={formData.employmentManager}
              onChange={(e) => handleChange('employmentManager', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">정원</Label>
            <Input
              id="capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => handleChange('capacity', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tuition">훈련비</Label>
            <Input
              id="tuition"
              type="number"
              value={formData.tuition}
              onChange={(e) => handleChange('tuition', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentStudentsGov">실시인원(국비)</Label>
            <Input
              id="currentStudentsGov"
              type="number"
              value={formData.currentStudentsGov}
              onChange={(e) => handleChange('currentStudentsGov', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentStudentsGen">실시인원(일반)</Label>
            <Input
              id="currentStudentsGen"
              type="number"
              value={formData.currentStudentsGen}
              onChange={(e) => handleChange('currentStudentsGen', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recruitmentRate">모집률 (%)</Label>
            <Input
              id="recruitmentRate"
              type="number"
              step="0.1"
              value={formData.recruitmentRate}
              onChange={(e) => handleChange('recruitmentRate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dropouts">중탈</Label>
            <Input
              id="dropouts"
              type="number"
              value={formData.dropouts}
              onChange={(e) => handleChange('dropouts', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="completionCount">수료인원</Label>
            <Input
              id="completionCount"
              type="number"
              value={formData.completionCount}
              onChange={(e) => handleChange('completionCount', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="completionRate">수료율 (%)</Label>
            <Input
              id="completionRate"
              type="number"
              step="0.1"
              value={formData.completionRate}
              onChange={(e) => handleChange('completionRate', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 특강 및 행사 */}
      <Card>
        <CardHeader>
          <CardTitle>특강 및 행사</CardTitle>
          <CardDescription>특강 및 작품발표회 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="specialLecture1">취업특강1</Label>
            <Input
              id="specialLecture1"
              value={formData.specialLecture1}
              onChange={(e) => handleChange('specialLecture1', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialLecture1Time">취업특강1 시간</Label>
            <Input
              id="specialLecture1Time"
              type="number"
              step="0.1"
              value={formData.specialLecture1Time}
              onChange={(e) => handleChange('specialLecture1Time', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialLecture2">취업특강2</Label>
            <Input
              id="specialLecture2"
              value={formData.specialLecture2}
              onChange={(e) => handleChange('specialLecture2', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialLecture2Time">취업특강2 시간</Label>
            <Input
              id="specialLecture2Time"
              type="number"
              step="0.1"
              value={formData.specialLecture2Time}
              onChange={(e) => handleChange('specialLecture2Time', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presentationDate">작품발표회 날짜</Label>
            <Input
              id="presentationDate"
              type="date"
              value={formData.presentationDate}
              onChange={(e) => handleChange('presentationDate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presentationTime">작품발표회 시간</Label>
            <Input
              id="presentationTime"
              type="number"
              step="0.1"
              value={formData.presentationTime}
              onChange={(e) => handleChange('presentationTime', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 운영 변동 사항 */}
      <Card>
        <CardHeader>
          <CardTitle>운영 변동 사항</CardTitle>
          <CardDescription>운영 변동 및 특이사항을 입력하세요</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="changeStartDate">변동 적용 시작일</Label>
            <Input
              id="changeStartDate"
              type="date"
              value={formData.changeStartDate}
              onChange={(e) => handleChange('changeStartDate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="changedRoom">변동 강의장</Label>
            <Input
              id="changedRoom"
              value={formData.changedRoom}
              onChange={(e) => handleChange('changedRoom', e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="scheduleChange">일정변경 내역</Label>
            <Textarea
              id="scheduleChange"
              value={formData.scheduleChange}
              onChange={(e) => handleChange('scheduleChange', e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="operationNote">특이사항/운영DATA</Label>
            <Textarea
              id="operationNote"
              value={formData.operationNote}
              onChange={(e) => handleChange('operationNote', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? '저장 중...' : mode === 'create' ? '생성' : '수정'}
        </Button>
      </div>
    </form>
  )
}
