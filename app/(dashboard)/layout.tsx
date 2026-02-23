import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const initial = user.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f5fb' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <header className="no-print bg-white h-14 flex items-center justify-between px-6 flex-shrink-0" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)' }} />
            <span className="text-sm font-semibold text-slate-600 tracking-tight">학사 관리 시스템</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
              >
                {initial}
              </div>
              <span className="text-xs text-slate-500 max-w-[180px] truncate">{user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </header>
        {/* 콘텐츠 */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
