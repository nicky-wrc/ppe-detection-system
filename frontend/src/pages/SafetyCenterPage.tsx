import { ShieldCheck } from 'lucide-react'

import { Layout } from '../components/layout/Layout'
// AlertsPage is temporarily hidden from the frontend; keep the route in App.tsx for restoration.
// import { AlertsPage } from './AlertsPage'
import { HistoryPage } from './HistoryPage'

export function SafetyCenterPage() {
  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={1.8} />
          </div>
          <h1>Reports</h1>
          <p className="max-w-3xl !mt-3 !text-[17px] !leading-[1.47]">
            ตรวจสอบประวัติ รายละเอียด และดาวน์โหลดหลักฐานการตรวจจับได้จากหน้าเดียว
          </p>
        </header>

        <HistoryPage embedded />
      </div>
    </Layout>
  )
}
