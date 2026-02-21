'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaitlistEntry {
  id: number
  name: string
  phone: string
  course_name: string
  schedule: string | null
  time_slot: string | null
  note: string | null
  created_at: string
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  course_name: '',
  schedule: '',
  time_slot: '',
  note: '',
}

// ── Option Labels ──────────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS = [
  { value: '', label: '선택 안 함' },
  { value: '평일', label: '평일' },
  { value: '주말', label: '주말' },
  { value: '상관없음', label: '상관없음' },
]

const TIME_SLOT_OPTIONS = [
  { value: '', label: '선택 안 함' },
  { value: '오전', label: '오전' },
  { value: '오후', label: '오후' },
  { value: '저녁', label: '저녁' },
  { value: '상관없음', label: '상관없음' },
]

const SCHEDULE_BADGE: Record<string, string> = {
  '평일': 'bg-blue-100 text-blue-700',
  '주말': 'bg-violet-100 text-violet-700',
  '상관없음': 'bg-gray-100 text-gray-600',
}

const TIME_BADGE: Record<string, string> = {
  '오전': 'bg-amber-100 text-amber-700',
  '오후': 'bg-emerald-100 text-emerald-700',
  '저녁': 'bg-indigo-100 text-indigo-700',
  '상관없음': 'bg-gray-100 text-gray-600',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // 필터
  const [search, setSearch] = useState('')
  const [filterSchedule, setFilterSchedule] = useState('')

  // 삭제 확인
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist')
      if (!res.ok) throw new Error('조회 실패')
      setEntries(await res.json())
    } catch {
      setError('데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const openAddForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }

  const openEditForm = (entry: WaitlistEntry) => {
    setEditingId(entry.id)
    setForm({
      name: entry.name,
      phone: entry.phone,
      course_name: entry.course_name,
      schedule: entry.schedule ?? '',
      time_slot: entry.time_slot ?? '',
      note: entry.note ?? '',
    })
    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.course_name.trim()) {
      setFormError('이름, 전화번호, 과정명은 필수 입력 항목입니다')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        course_name: form.course_name.trim(),
        schedule: form.schedule || null,
        time_slot: form.time_slot || null,
        note: form.note.trim() || null,
      }

      const url = editingId ? `/api/waitlist/${editingId}` : '/api/waitlist'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '저장 실패')
      }

      closeForm()
      await fetchEntries()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      setDeletingId(null)
      await fetchEntries()
    } catch {
      alert('삭제 중 오류가 발생했습니다')
    }
  }

  // 필터링
  const filtered = entries.filter((e) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.phone.includes(q) ||
      e.course_name.toLowerCase().includes(q)
    const matchSchedule = !filterSchedule || e.schedule === filterSchedule
    return matchSearch && matchSchedule
  })

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">차기 개강 대기자</h2>
          <p className="text-muted-foreground">다음 일정을 희망하는 수강 대기자 명부</p>
        </div>
        <Button onClick={openAddForm} className="shrink-0">+ 대기자 등록</Button>
      </div>

      {/* 등록 / 수정 폼 */}
      {showForm && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? '대기자 수정' : '대기자 등록'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* 필수 필드 */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  이름 <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="홍길동"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  과정명 <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="예: 포토샵, 캐드, 전산회계..."
                  value={form.course_name}
                  onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                />
              </div>

              {/* 선택 필드 */}
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-500">일정 선호 (선택)</label>
                <select
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                >
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-500">시간대 선호 (선택)</label>
                <select
                  value={form.time_slot}
                  onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                >
                  {TIME_SLOT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-500">비고 (선택)</label>
                <Input
                  placeholder="특이사항 메모"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-500 mt-3">{formError}</p>
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : editingId ? '수정 완료' : '등록'}
              </Button>
              <Button variant="outline" onClick={closeForm} disabled={saving}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 필터 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="이름·전화번호·과정명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={filterSchedule}
              onChange={(e) => setFilterSchedule(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="">일정 전체</option>
              {SCHEDULE_OPTIONS.slice(1).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground ml-auto">
              총 <strong>{filtered.length}</strong>명
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-4 rounded-md border border-red-200">{error}</div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>
      )}

      {/* 목록 테이블 */}
      {!loading && (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-sm">
                  {entries.length === 0 ? '등록된 대기자가 없습니다' : '검색 결과가 없습니다'}
                </p>
                {entries.length === 0 && (
                  <Button variant="outline" className="mt-4" onClick={openAddForm}>
                    첫 대기자 등록하기
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-600">
                      <th className="text-left px-4 py-3 font-semibold w-[50px]">#</th>
                      <th className="text-left px-4 py-3 font-semibold w-[90px]">이름</th>
                      <th className="text-left px-4 py-3 font-semibold w-[130px]">전화번호</th>
                      <th className="text-left px-4 py-3 font-semibold">과정명</th>
                      <th className="text-left px-4 py-3 font-semibold w-[90px]">일정</th>
                      <th className="text-left px-4 py-3 font-semibold w-[90px]">시간대</th>
                      <th className="text-left px-4 py-3 font-semibold">비고</th>
                      <th className="text-left px-4 py-3 font-semibold w-[90px]">등록일</th>
                      <th className="px-4 py-3 w-[100px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry, idx) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold">{entry.name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{entry.phone}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-800">{entry.course_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.schedule ? (
                            <Badge className={`text-xs ${SCHEDULE_BADGE[entry.schedule] ?? 'bg-gray-100 text-gray-600'} hover:opacity-90`}>
                              {entry.schedule}
                            </Badge>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entry.time_slot ? (
                            <Badge className={`text-xs ${TIME_BADGE[entry.time_slot] ?? 'bg-gray-100 text-gray-600'} hover:opacity-90`}>
                              {entry.time_slot}
                            </Badge>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">
                          <span className="truncate block" title={entry.note ?? ''}>
                            {entry.note || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {fmtDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end">
                            {deletingId === entry.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs px-2"
                                  onClick={() => handleDelete(entry.id)}
                                >
                                  삭제 확인
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => setDeletingId(null)}
                                >
                                  취소
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => openEditForm(entry)}
                                >
                                  수정
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 text-red-500 border-red-200 hover:bg-red-50"
                                  onClick={() => setDeletingId(entry.id)}
                                >
                                  삭제
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
