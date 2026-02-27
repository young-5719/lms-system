'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LayoutDashboard, BookOpen, ClipboardList,
  CalendarDays, BarChart3, Search,
  FileText, TrendingUp, UserPlus, ChevronRight, Briefcase,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    items: [
      { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    ],
  },
  {
    label: '학사 관리',
    items: [
      { href: '/courses', label: '과정 관리', icon: BookOpen },
      { href: '/attendance', label: '출석부', icon: ClipboardList },
      { href: '/waitlist', label: '차기 개강 대기자', icon: UserPlus },
      { href: '/rollover-survey', label: '이월희망조사표', icon: FileText },
    ],
  },
  {
    label: '강의장',
    items: [
      { href: '/room-schedule', label: '강의장 시간표', icon: CalendarDays },
    ],
  },
  {
    label: '분석',
    items: [
      { href: '/statistics', label: '통계', icon: BarChart3 },
      { href: '/employment', label: '취업률 현황', icon: Briefcase },
      { href: '/revenue', label: '국비지원 예상매출', icon: TrendingUp },
      { href: '/competitors', label: '경쟁기관', icon: Search },
    ],
  },
]

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* 햄버거 버튼 - 모바일에서만 표시 */}
      <button
        className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      {/* 오버레이 + 드로어 */}
      {open && (
        <>
          {/* 배경 딤 처리 */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* 사이드바 드로어 */}
          <aside
            className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden"
            style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #152d4a 100%)' }}
          >
            {/* 로고 + 닫기 버튼 */}
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-white text-base"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                >
                  L
                </div>
                <div>
                  <div className="text-white font-bold text-sm leading-tight tracking-wide">LMS</div>
                  <div className="text-blue-300/70 text-[10px] leading-tight tracking-wider">학사관리시스템</div>
                </div>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="메뉴 닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* 네비게이션 */}
            <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
              {NAV_SECTIONS.map((section, si) => (
                <div key={si}>
                  {section.label && (
                    <div className="px-3 mb-1.5">
                      <span className="text-[10px] font-semibold tracking-widest text-blue-300/40 uppercase">
                        {section.label}
                      </span>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href ||
                        (item.href !== '/dashboard' && pathname.startsWith(item.href))
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 hover:text-white hover:bg-white/8'
                          }`}
                          style={isActive ? {
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                          } : {}}
                        >
                          <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} strokeWidth={2} />
                          <span className="flex-1 leading-none">{item.label}</span>
                          {isActive && <ChevronRight size={12} className="text-white/60" />}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* 하단 */}
            <div className="px-5 py-4 border-t border-white/10">
              <p className="text-[10px] text-blue-300/30 text-center">© 2026 LMS System</p>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
