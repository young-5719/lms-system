'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/courses', label: '과정 관리', icon: '📚' },
  { href: '/attendance', label: '출석부', icon: '📋' },
  { href: '/empty-rooms', label: '빈 강의장', icon: '🏫' },
  { href: '/room-schedule', label: '강의장 시간표', icon: '🗓️' },
  { href: '/instructors', label: '강사별 수업시간', icon: '👨‍🏫' },
  { href: '/statistics', label: '통계', icon: '📈' },
  { href: '/competitors', label: '경쟁기관', icon: '🔍' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="no-print w-56 bg-white border-r min-h-screen flex-shrink-0">
      <div className="px-4 py-5 border-b">
        <Link href="/dashboard">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">LMS<br />학사 관리 시스템</h1>
        </Link>
      </div>
      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
