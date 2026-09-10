import { Bell, FileText, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { Layout } from '../components/layout/Layout'
import { useAuthStore } from '../stores/authStore'
import { AlertsPage } from './AlertsPage'
import { HistoryPage } from './HistoryPage'

const views = [
  {
    path: '/reports',
    label: 'รายงานย้อนหลัง',
    description: 'ค้นหา ตรวจสอบ และดาวน์โหลดผลการตรวจจับ',
    icon: FileText,
  },
  {
    path: '/alerts',
    label: 'การแจ้งเตือน',
    description: 'รับทราบ ติดตาม และปิดเหตุการณ์ฝ่าฝืน',
    icon: Bell,
  },
]

export function SafetyCenterPage() {
  const location = useLocation()
  const canManageAlerts = useAuthStore((state) => (
    state.user?.role === 'admin' || state.user?.role === 'safety_officer'
  ))
  const activePath = location.pathname.startsWith('/alerts') ? '/alerts' : '/reports'

  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={1.8} />
          </div>
          <h1>Reports &amp; Alerts</h1>
          <p className="max-w-3xl !mt-3 !text-[17px] !leading-[1.47]">
            {canManageAlerts
              ? 'ตรวจสอบประวัติผลการตรวจจับและจัดการเหตุการณ์ความปลอดภัยได้จากหน้าเดียว'
              : 'ตรวจสอบประวัติ เหตุการณ์ รายละเอียด และหลักฐานส่วนกลางได้ในโหมดอ่านอย่างเดียว'}
          </p>
        </header>

        <nav className="grid grid-cols-1 gap-3 rounded-[22px] border border-[var(--line)] bg-[#f5f5f7] p-2 sm:grid-cols-2" aria-label="Reports and alerts sections">
          {views.map((view) => {
            const isActive = activePath === view.path
            return (
              <Link
                key={view.path}
                to={view.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[84px] items-center gap-4 rounded-[16px] border px-5 py-4 transition-colors active:scale-[0.99] ${
                  isActive
                    ? 'border-[var(--line)] bg-white text-[var(--ink)] shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                    : 'border-transparent text-[var(--muted)] hover:bg-white/70 hover:text-[var(--ink)]'
                }`}
              >
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-[var(--blue)] text-white' : 'bg-white text-[var(--muted)]'}`} aria-hidden="true">
                  <view.icon size={18} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-[15px] font-semibold">{view.label}</strong>
                  <small className="mt-1 block text-[13px] leading-snug text-[var(--muted)]">
                    {!canManageAlerts && view.path === '/alerts'
                      ? 'ดูสถานะ รายละเอียด และหลักฐานเหตุการณ์แบบอ่านอย่างเดียว'
                      : view.description}
                  </small>
                </span>
              </Link>
            )
          })}
        </nav>

        {activePath === '/alerts' ? <AlertsPage embedded /> : <HistoryPage embedded />}
      </div>
    </Layout>
  )
}
