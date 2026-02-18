import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CourseForm from '@/components/courses/CourseForm'

export default async function EditCoursePage({
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

  // Convert dates to strings for the form
  const courseData = {
    ...course,
    startDate: course.startDate.toISOString(),
    endDate: course.endDate.toISOString(),
    presentationDate: course.presentationDate?.toISOString() || null,
    changeStartDate: course.changeStartDate?.toISOString() || null,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">과정 수정</h2>
        <p className="text-muted-foreground">{course.courseName}</p>
      </div>

      <CourseForm mode="edit" initialData={courseData} />
    </div>
  )
}
