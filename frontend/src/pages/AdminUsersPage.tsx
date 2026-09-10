import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { adminService } from '../services/admin'
import type { AdminUserUpdate } from '../services/admin'
import { useAuthStore } from '../stores/authStore'
import type { User, UserRole } from '../types'

type RoleFilter = 'all' | UserRole

interface CreateFormErrors {
  fullName?: string
  email?: string
  password?: string
  submit?: string
}

interface ApiErrorBody {
  detail?: string | Array<{ msg?: string }>
}

const roles: Array<{
  value: UserRole
  label: string
  shortLabel: string
  description: string
}> = [
  {
    value: 'viewer',
    label: 'Viewer',
    shortLabel: 'Viewer',
    description: 'อ่าน Dashboard สถิติ กราฟ เหตุการณ์ รายละเอียด และหลักฐานส่วนกลางได้ แต่แก้ไขไม่ได้',
  },
  {
    value: 'safety_officer',
    label: 'Safety officer',
    shortLabel: 'Safety officer',
    description: 'ควบคุมการตรวจจับและกล้อง พร้อมรับทราบหรือปิดเหตุการณ์ แต่จัดการผู้ใช้และโครงสร้างระบบไม่ได้',
  },
  {
    value: 'admin',
    label: 'Administrator',
    shortLabel: 'Admin',
    description: 'ใช้งานทุกส่วน รวมจัดการผู้ใช้ ทะเบียนกล้อง โซน การตั้งค่า และงานตรวจจับหรือเหตุการณ์',
  },
]

const fieldClassName = 'mt-2 min-h-12 w-full rounded-[11px] border bg-white px-4 text-[15px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50'

const roleLabel = (role: UserRole) => roles.find((option) => option.value === role)?.shortLabel ?? role

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!isAxiosError<ApiErrorBody>(error)) return fallback

  const detail = error.response?.data?.detail
  if (detail === 'Email already exists') return 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น'
  if (detail === 'Invalid role') return 'Role ที่เลือกไม่ถูกต้อง กรุณาเลือกใหม่'
  if (detail === 'You cannot deactivate your own account') return 'ไม่สามารถปิดบัญชีที่กำลังใช้งานอยู่ได้'
  if (error.response?.status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ'
  if (Array.isArray(detail)) {
    const message = detail.map((item) => item.msg).filter(Boolean).join(', ')
    if (message) return message
  }
  if (typeof detail === 'string' && detail.trim()) return detail
  return fallback
}

export function AdminUsersPage() {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingUserIds, setUpdatingUserIds] = useState<Set<number>>(() => new Set())
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<UserRole>('viewer')
  const [formErrors, setFormErrors] = useState<CreateFormErrors>({})
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const listRequestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = listRequestRef.current + 1
    listRequestRef.current = requestId
    setLoading(true)
    setLoadError(false)
    try {
      const nextUsers = await adminService.listUsers()
      if (listRequestRef.current !== requestId) return
      setUsers(nextUsers)
    } catch (error) {
      if (listRequestRef.current !== requestId) return
      console.error(error)
      setLoadError(true)
      toast.error(getApiErrorMessage(error, 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ'))
    } finally {
      if (listRequestRef.current === requestId) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      listRequestRef.current += 1
    }
  }, [load])

  const clearFieldError = (field: keyof CreateFormErrors) => {
    setFormErrors((current) => ({ ...current, [field]: undefined, submit: undefined }))
  }

  const resetForm = () => {
    setEmail('')
    setFullName('')
    setPassword('')
    setShowPassword(false)
    setRole('viewer')
    setFormErrors({})
  }

  const validateCreateForm = () => {
    const errors: CreateFormErrors = {}
    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedName.length < 2) errors.fullName = 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = 'กรุณากรอกอีเมลให้ถูกต้อง'
    if (password.length < 10) errors.password = 'รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร'
    if (password.length > 128) errors.password = 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร'

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const generateTemporaryPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    const randomValues = new Uint32Array(14)
    crypto.getRandomValues(randomValues)
    setPassword(Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join(''))
    setShowPassword(true)
    clearFieldError('password')
  }

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateCreateForm()) return

    setSaving(true)
    setFormErrors({})
    try {
      const created = await adminService.createUser({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        password,
        role,
      })
      setUsers((current) => [created, ...current.filter((user) => user.id !== created.id)])
      resetForm()
      toast.success(`สร้างบัญชี ${created.email} แล้ว`)
    } catch (error) {
      console.error(error)
      const message = getApiErrorMessage(error, 'สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่')
      setFormErrors((current) => ({ ...current, submit: message }))
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const updateUser = async (user: User, payload: AdminUserUpdate, successMessage: string) => {
    setUpdatingUserIds((current) => new Set(current).add(user.id))
    try {
      const updated = await adminService.updateUser(user.id, payload)
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item))
      toast.success(successMessage)
    } catch (error) {
      console.error(error)
      toast.error(getApiErrorMessage(error, 'อัปเดตผู้ใช้ไม่สำเร็จ'))
    } finally {
      setUpdatingUserIds((current) => {
        const next = new Set(current)
        next.delete(user.id)
        return next
      })
    }
  }

  const changeRole = (user: User, nextRole: UserRole) => {
    if (nextRole === user.role) return
    void updateUser(user, { role: nextRole }, `เปลี่ยน Role ของ ${user.full_name} เป็น ${roleLabel(nextRole)} แล้ว`)
  }

  const toggleUserStatus = (user: User) => {
    if (user.is_active && !window.confirm(`ปิดการใช้งานบัญชี ${user.email} หรือไม่?`)) return
    const nextActive = !user.is_active
    void updateUser(
      user,
      { is_active: nextActive },
      nextActive ? `เปิดใช้งานบัญชี ${user.email} แล้ว` : `ปิดใช้งานบัญชี ${user.email} แล้ว`,
    )
  }

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery
        || user.full_name.toLowerCase().includes(normalizedQuery)
        || user.email.toLowerCase().includes(normalizedQuery)
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      return matchesQuery && matchesRole
    })
  }, [query, roleFilter, users])

  const activeCount = users.filter((user) => user.is_active).length
  const adminCount = users.filter((user) => user.role === 'admin').length

  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <UserCog size={20} strokeWidth={1.8} />
            </div>
            <h1>จัดการผู้ใช้</h1>
            <p className="max-w-2xl !mt-3 !text-[17px] !leading-[1.47]">
              สร้างบัญชี กำหนด Role และควบคุมสถานะการเข้าใช้งานระบบ
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-apple-secondary !min-h-11 active:scale-95"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            รีเฟรชข้อมูล
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="สรุปบัญชีผู้ใช้">
          {[
            { label: 'บัญชีทั้งหมด', value: users.length, icon: Users, className: 'text-[var(--blue)]' },
            { label: 'กำลังใช้งาน', value: activeCount, icon: CheckCircle2, className: 'text-[#15803d]' },
            { label: 'ผู้ดูแลระบบ', value: adminCount, icon: ShieldCheck, className: 'text-[#7c3aed]' },
          ].map((stat) => (
            <div key={stat.label} className="surface-card flex min-h-28 items-center justify-between gap-4 p-5 sm:p-6">
              <div>
                <p className="text-[13px] text-[var(--muted)]">{stat.label}</p>
                <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-[var(--ink)] tabular-nums">{stat.value}</p>
              </div>
              <stat.icon size={21} className={stat.className} strokeWidth={1.8} aria-hidden="true" />
            </div>
          ))}
        </section>

        <section className="surface-card overflow-hidden" aria-labelledby="create-user-title">
          <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
            <h2 id="create-user-title" className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              <UserPlus size={19} className="text-[var(--blue)]" aria-hidden="true" />
              สร้างบัญชีใหม่
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">กรอกข้อมูลให้ครบและเลือก Role ให้ตรงกับหน้าที่ของผู้ใช้งาน</p>
          </div>

          <form onSubmit={(event) => void createUser(event)} noValidate className="p-6 sm:p-8">
            {formErrors.submit && (
              <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-[#f0c3c8] bg-[#fff8f8] px-4 py-3 text-[14px] text-[#d70015]" role="alert">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{formErrors.submit}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="text-[14px] font-semibold text-[var(--ink)]">
                ชื่อและนามสกุล <span className="text-[#d70015]">*</span>
                <input
                  value={fullName}
                  onChange={(event) => { setFullName(event.target.value); clearFieldError('fullName') }}
                  autoComplete="name"
                  placeholder="เช่น สมชาย ใจดี"
                  maxLength={255}
                  disabled={saving}
                  aria-invalid={Boolean(formErrors.fullName)}
                  aria-describedby={formErrors.fullName ? 'full-name-error' : undefined}
                  className={`${fieldClassName} ${formErrors.fullName ? 'border-[#d70015]' : 'border-[var(--line)]'}`}
                />
                {formErrors.fullName && <span id="full-name-error" className="mt-2 block text-[12px] font-normal text-[#d70015]">{formErrors.fullName}</span>}
              </label>

              <label className="text-[14px] font-semibold text-[var(--ink)]">
                อีเมลสำหรับเข้าสู่ระบบ <span className="text-[#d70015]">*</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); clearFieldError('email') }}
                  autoComplete="email"
                  placeholder="name@company.com"
                  maxLength={255}
                  disabled={saving}
                  aria-invalid={Boolean(formErrors.email)}
                  aria-describedby={formErrors.email ? 'email-error' : undefined}
                  className={`${fieldClassName} ${formErrors.email ? 'border-[#d70015]' : 'border-[var(--line)]'}`}
                />
                {formErrors.email && <span id="email-error" className="mt-2 block text-[12px] font-normal text-[#d70015]">{formErrors.email}</span>}
              </label>

              <div className="text-[14px] font-semibold text-[var(--ink)]">
                <label htmlFor="temporary-password">รหัสผ่านชั่วคราว <span className="text-[#d70015]">*</span></label>
                <div className="relative">
                  <input
                    id="temporary-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); clearFieldError('password') }}
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="อย่างน้อย 10 ตัวอักษร"
                    disabled={saving}
                    aria-invalid={Boolean(formErrors.password)}
                    aria-describedby="password-help"
                    className={`${fieldClassName} pr-12 ${formErrors.password ? 'border-[#d70015]' : 'border-[var(--line)]'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={!password || saving}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="absolute right-1.5 top-[14px] inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[#f5f5f7] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
                <div id="password-help" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] font-normal">
                  <span className={formErrors.password ? 'text-[#d70015]' : 'text-[var(--muted)]'}>{formErrors.password ?? 'ความยาว 10–128 ตัวอักษร'}</span>
                  <button type="button" onClick={generateTemporaryPassword} disabled={saving} className="inline-flex items-center gap-1.5 font-semibold text-[var(--blue)] hover:underline disabled:opacity-50">
                    <KeyRound size={13} aria-hidden="true" /> สร้างรหัสผ่านให้
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[14px] font-semibold text-[var(--ink)]">Role <span className="text-[#d70015]">*</span></p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3" role="group" aria-label="เลือก Role สำหรับบัญชีใหม่">
                  {roles.map((option) => {
                    const selected = role === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRole(option.value)}
                        disabled={saving}
                        aria-pressed={selected}
                        className={`min-h-[84px] rounded-[12px] border p-3 text-left transition-colors disabled:opacity-50 ${
                          selected
                            ? 'border-[var(--blue)] bg-[#f0f7ff] text-[var(--ink)]'
                            : 'border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#f5f5f7]'
                        }`}
                      >
                        <span className="block text-[13px] font-semibold">{option.label}</span>
                        <span className="mt-1 block text-[11px] font-normal leading-snug text-[var(--muted)]">{option.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetForm} disabled={saving} className="btn-apple-secondary !min-h-11 active:scale-95">ล้างข้อมูล</button>
              <button type="submit" disabled={saving} className="btn-apple-primary min-w-40 !min-h-11 active:scale-95">
                {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                {saving ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชีผู้ใช้'}
              </button>
            </div>
          </form>
        </section>

        <section className="surface-card overflow-hidden" aria-labelledby="accounts-title">
          <div className="flex flex-col gap-5 border-b border-[var(--line)] px-6 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="accounts-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">บัญชีในระบบ</h2>
              <p className="mt-1 text-[14px] text-[var(--muted)]">เปลี่ยน Role หรือเปิด–ปิดการใช้งานได้จากรายการนี้</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <label className="relative min-w-0 flex-1 lg:w-72">
                <span className="sr-only">ค้นหาผู้ใช้</span>
                <Search size={16} className="pointer-events-none absolute left-4 top-3.5 text-[var(--muted)]" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาชื่อหรืออีเมล"
                  className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white pl-10 pr-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                />
              </label>
              <label>
                <span className="sr-only">กรองตาม Role</span>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                  className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white px-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)] sm:w-auto"
                >
                  <option value="all">ทุก Role</option>
                  {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {loadError && users.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-[#f0c3c8] bg-[#fff8f8] px-6 py-4 text-[14px] text-[#d70015] sm:flex-row sm:items-center sm:justify-between sm:px-8" role="alert">
              <span className="inline-flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" />รีเฟรชข้อมูลไม่สำเร็จ รายการด้านล่างอาจไม่ใช่ข้อมูลล่าสุด</span>
              <button type="button" onClick={() => void load()} className="font-semibold hover:underline">ลองอีกครั้ง</button>
            </div>
          )}

          {loading && users.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
              <Loader2 size={20} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
              กำลังโหลดบัญชี…
            </div>
          ) : loadError && users.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
              <AlertTriangle size={28} className="text-[#d70015]" strokeWidth={1.6} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-[var(--ink)]">โหลดบัญชีไม่สำเร็จ</p>
              <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">ตรวจสอบการเชื่อมต่อและสิทธิ์ผู้ดูแลระบบแล้วลองอีกครั้ง</p>
              <button type="button" onClick={() => void load()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">ลองอีกครั้ง</button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <Users size={28} className="text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-[var(--ink)]">{users.length === 0 ? 'ยังไม่มีบัญชีผู้ใช้' : 'ไม่พบบัญชีที่ค้นหา'}</p>
              <p className="text-[15px] text-[var(--muted)]">{users.length === 0 ? 'สร้างบัญชีแรกได้จากแบบฟอร์มด้านบน' : 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง Role'}</p>
              {users.length > 0 && (
                <button type="button" onClick={() => { setQuery(''); setRoleFilter('all') }} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">ล้างตัวกรอง</button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f7] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
                      <th scope="col" className="px-6 py-4 sm:px-8">ผู้ใช้</th>
                      <th scope="col" className="px-6 py-4">Role</th>
                      <th scope="col" className="px-6 py-4">สถานะ</th>
                      <th scope="col" className="px-6 py-4 sm:pr-8">วันที่สร้าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isCurrentUser = user.id === currentUserId
                      const isUpdating = updatingUserIds.has(user.id)
                      return (
                        <tr key={user.id} className="border-t border-[var(--line)] transition-colors hover:bg-[#fafafc]">
                          <td className="px-6 py-5 sm:px-8">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f7ff] text-[14px] font-semibold text-[var(--blue)]" aria-hidden="true">
                                {user.full_name.charAt(0).toUpperCase() || 'U'}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-[15px] font-semibold text-[var(--ink)]">{user.full_name}</p>
                                  {isCurrentUser && <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">บัญชีของคุณ</span>}
                                </div>
                                <p className="mt-1 truncate text-[13px] text-[var(--muted)]">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <label className="sr-only" htmlFor={`role-${user.id}`}>Role ของ {user.full_name}</label>
                              <select
                                id={`role-${user.id}`}
                                value={user.role}
                                onChange={(event) => changeRole(user, event.target.value as UserRole)}
                                disabled={isCurrentUser || isUpdating}
                                title={isCurrentUser ? 'ไม่สามารถเปลี่ยน Role ของบัญชีที่กำลังใช้งาน' : 'เลือกแล้วระบบจะบันทึกทันที'}
                                className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:bg-[#f5f5f7] disabled:opacity-60"
                              >
                                {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                              {isUpdating && <Loader2 size={16} className="animate-spin text-[var(--blue)]" aria-label="กำลังบันทึก" />}
                            </div>
                            {isCurrentUser && <p className="mt-1.5 text-[11px] text-[var(--muted)]">ป้องกันการแก้สิทธิ์ตัวเอง</p>}
                          </td>
                          <td className="px-6 py-5">
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(user)}
                              disabled={isCurrentUser || isUpdating}
                              aria-label={`${user.is_active ? 'ปิด' : 'เปิด'}การใช้งาน ${user.full_name}`}
                              aria-pressed={user.is_active}
                              title={isCurrentUser ? 'ไม่สามารถปิดบัญชีที่กำลังใช้งาน' : undefined}
                              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                                user.is_active
                                  ? 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                                  : 'border-[#f0c3c8] bg-[#fff8f8] text-[#d70015]'
                              }`}
                            >
                              {isUpdating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
                              {user.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-6 py-5 text-[13px] text-[var(--muted)] sm:pr-8">
                            {new Date(user.created_at).toLocaleString('th-TH', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-1 border-t border-[var(--line)] bg-[#f5f5f7] px-6 py-4 text-[13px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <span>แสดง {filteredUsers.length} จาก {users.length} บัญชี</span>
                <span>การเปลี่ยน Role และสถานะจะบันทึกทันที</span>
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  )
}
