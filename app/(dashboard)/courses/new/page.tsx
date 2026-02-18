import CourseForm from '@/components/courses/CourseForm'

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">새 과정 추가</h2>
        <p className="text-muted-foreground">새로운 과정의 정보를 입력하세요</p>
      </div>

      <CourseForm mode="create" />
    </div>
  )
}
