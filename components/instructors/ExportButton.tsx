'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default function ExportButton() {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/export/instructors')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '강사별_수업시간_2026.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('엑셀 다운로드에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading} variant="outline" size="sm">
      <Download className="mr-2 h-4 w-4" />
      {loading ? '다운로드 중...' : '엑셀 내보내기'}
    </Button>
  )
}
