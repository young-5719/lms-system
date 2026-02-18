'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface DeleteCourseButtonProps {
  courseId: number
}

export default function DeleteCourseButton({ courseId }: DeleteCourseButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('정말로 이 과정을 삭제하시겠습니까?')) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.refresh()
      } else {
        alert('과정 삭제에 실패했습니다')
      }
    } catch (error) {
      alert('과정 삭제 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? '삭제 중...' : '삭제'}
    </Button>
  )
}
