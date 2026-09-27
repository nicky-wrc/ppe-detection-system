import { ShieldCheck } from 'lucide-react'

import { Layout } from '../components/layout/Layout'
// AlertsPage is temporarily hidden from the frontend; keep the route in App.tsx for restoration.
// import { AlertsPage } from './AlertsPage'
import { HistoryPage } from './HistoryPage'
import { useLanguage } from '../i18n/LanguageContext'

export function SafetyCenterPage() {
  const { text } = useLanguage()
  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading">
          <div className="flex items-start gap-4">
            <div className="mt-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <ShieldCheck size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h1>{text('รายงาน', 'Reports')}</h1>
              <p className="max-w-3xl !mt-2 !text-[17px] !leading-[1.47]">
                {text('ดูประวัติ รายละเอียด และดาวน์โหลดหลักฐานการตรวจจับได้ในหน้าเดียว', 'Review history, details, and download detection evidence in one place.')}
              </p>
            </div>
          </div>
        </header>

        <HistoryPage embedded />
      </div>
    </Layout>
  )
}
