import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
import { useLanguage } from '../i18n/LanguageContext'

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
  labelTh: string
  labelEn: string
  shortLabelTh: string
  shortLabelEn: string
  descriptionTh: string
  descriptionEn: string
}> = [
  {
    value: 'viewer',
    labelTh: 'ผู้ดูข้อมูล',
    labelEn: 'Viewer',
    shortLabelTh: 'ผู้ดูข้อมูล',
    shortLabelEn: 'Viewer',
    descriptionTh: 'ดูแดชบอร์ด สถิติ เหตุการณ์ และหลักฐานได้ แต่แก้ไขข้อมูลไม่ได้',
    descriptionEn: 'Can view dashboards, statistics, events, and evidence, but cannot make changes.',
  },
  {
    value: 'safety_officer',
    labelTh: 'เจ้าหน้าที่ความปลอดภัย',
    labelEn: 'Safety officer',
    shortLabelTh: 'เจ้าหน้าที่ความปลอดภัย',
    shortLabelEn: 'Safety officer',
    descriptionTh: 'ควบคุมการตรวจจับและกล้อง รวมถึงรับทราบหรือปิดเหตุการณ์ได้',
    descriptionEn: 'Can control detection and cameras, and acknowledge or close events.',
  },
  {
    value: 'admin',
    labelTh: 'ผู้ดูแลระบบ',
    labelEn: 'Administrator',
    shortLabelTh: 'ผู้ดูแลระบบ',
    shortLabelEn: 'Admin',
    descriptionTh: 'ใช้งานได้ทุกส่วน รวมถึงจัดการผู้ใช้ กล้อง พื้นที่ และการตั้งค่าระบบ',
    descriptionEn: 'Has full access, including user, camera, zone, and system settings management.',
  },
]

const fieldClassName = 'mt-2 min-h-12 w-full rounded-[11px] border bg-white px-4 text-[15px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50'

const getApiErrorMessage = (error: unknown, fallback: string, isThai: boolean) => {
  if (!isAxiosError<ApiErrorBody>(error)) return fallback

  const detail = error.response?.data?.detail
  if (detail === 'Email already exists') return isThai ? 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น' : 'An account already uses this email.'
  if (detail === 'Invalid role') return isThai ? 'สิทธิ์ที่เลือกไม่ถูกต้อง กรุณาเลือกใหม่' : 'The selected role is invalid.'
  if (detail === 'You cannot deactivate your own account') return isThai ? 'ไม่สามารถปิดบัญชีที่กำลังใช้งานอยู่ได้' : 'You cannot deactivate your current account.'
  if (error.response?.status === 403) return isThai ? 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ' : 'This account does not have administrator access.'
  if (Array.isArray(detail)) {
    const message = detail.map((item) => item.msg).filter(Boolean).join(', ')
    if (message) return message
  }
  if (typeof detail === 'string' && detail.trim()) return detail
  return fallback
}

export function AdminUsersPage() {
  const { language, text } = useLanguage()
  const isThai = language === 'th'
  const getRoleLabel = (userRole: UserRole, short = false) => {
    const option = roles.find((item) => item.value === userRole)
    if (!option) return userRole
    if (short) return text(option.shortLabelTh, option.shortLabelEn)
    return text(option.labelTh, option.labelEn)
  }
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
  const [isCreateUserExpanded, setIsCreateUserExpanded] = useState(false)
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false)
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
      toast.error(getApiErrorMessage(error, text('โหลดรายชื่อผู้ใช้ไม่สำเร็จ', 'Unable to load users'), isThai))
    } finally {
      if (listRequestRef.current === requestId) setLoading(false)
    }
  }, [isThai, text])

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

    if (normalizedName.length < 2) errors.fullName = text('กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร', 'Enter at least 2 characters for the name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = text('กรุณากรอกอีเมลให้ถูกต้อง', 'Enter a valid email address.')
    if (password.length < 10) errors.password = text('รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร', 'Password must be at least 10 characters.')
    if (password.length > 128) errors.password = text('รหัสผ่านต้องไม่เกิน 128 ตัวอักษร', 'Password must not exceed 128 characters.')

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
      toast.success(text(`สร้างบัญชี ${created.email} แล้ว`, `Account ${created.email} created.`))
    } catch (error) {
      console.error(error)
      const message = getApiErrorMessage(error, text('สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่', 'Unable to create the account. Please try again.'), isThai)
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
      toast.error(getApiErrorMessage(error, text('อัปเดตผู้ใช้ไม่สำเร็จ', 'Unable to update the user'), isThai))
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
    void updateUser(
      user,
      { role: nextRole },
      text(
        `เปลี่ยนสิทธิ์ของ ${user.full_name} เป็น ${getRoleLabel(nextRole, true)} แล้ว`,
        `Changed ${user.full_name}'s role to ${getRoleLabel(nextRole, true)}.`,
      ),
    )
  }

  const toggleUserStatus = (user: User) => {
    if (user.is_active && !window.confirm(text(`ปิดการใช้งานบัญชี ${user.email} หรือไม่?`, `Disable account ${user.email}?`))) return
    const nextActive = !user.is_active
    void updateUser(
      user,
      { is_active: nextActive },
      nextActive ? text(`เปิดใช้งานบัญชี ${user.email} แล้ว`, `Account ${user.email} enabled.`) : text(`ปิดใช้งานบัญชี ${user.email} แล้ว`, `Account ${user.email} disabled.`),
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
          <div className="flex items-start gap-4">
            <div className="mt-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <UserCog size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h1>{text('จัดการผู้ใช้', 'User management')}</h1>
              <p className="max-w-2xl !mt-2 !text-[17px] !leading-[1.47]">
                {text('สร้างบัญชี กำหนดสิทธิ์ และเปิดหรือปิดการใช้งาน', 'Create accounts, assign roles, and control access.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-apple-secondary !min-h-11 active:scale-95"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {text('รีเฟรชข้อมูล', 'Refresh')}
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={text('สรุปบัญชีผู้ใช้', 'Account summary')}>
          {[
            { label: text('บัญชีทั้งหมด', 'All accounts'), value: users.length, icon: Users, className: 'text-[var(--blue)]' },
            { label: text('กำลังใช้งาน', 'Active'), value: activeCount, icon: CheckCircle2, className: 'text-[#15803d]' },
            { label: text('ผู้ดูแลระบบ', 'Administrators'), value: adminCount, icon: ShieldCheck, className: 'text-[#7c3aed]' },
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
          <button type="button" onClick={() => setIsCreateUserExpanded((current) => !current)} aria-expanded={isCreateUserExpanded} aria-controls="create-user-content" className={`group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[#f8f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--blue)] sm:px-8 ${isCreateUserExpanded ? 'border-b border-[var(--line)]' : ''}`}>
            <span className="min-w-0">
              <span id="create-user-title" className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]"><UserPlus size={19} className="text-[var(--blue)]" aria-hidden="true" />{text('สร้างบัญชีใหม่', 'Create account')}</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-[var(--muted)]">{text('กรอกข้อมูลและเลือกสิทธิ์ให้เหมาะกับผู้ใช้', 'Enter the account details and choose the appropriate role.')}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--ink)] group-hover:border-[var(--blue)] group-hover:text-[var(--blue)]">{isCreateUserExpanded ? text('พับ', 'Collapse') : text('เปิด', 'Expand')}<ChevronDown size={17} className={`transition-transform duration-200 ${isCreateUserExpanded ? 'rotate-180' : ''}`} aria-hidden="true" /></span>
          </button>
          {isCreateUserExpanded && (
          <form onSubmit={(event) => void createUser(event)} noValidate className="p-6 sm:p-8">
            {formErrors.submit && (
              <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-[#f0c3c8] bg-[#fff8f8] px-4 py-3 text-[14px] text-[#d70015]" role="alert">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{formErrors.submit}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="text-[14px] font-semibold text-[var(--ink)]">
                {text('ชื่อและนามสกุล', 'Full name')} <span className="text-[#d70015]">*</span>
                <input
                  value={fullName}
                  onChange={(event) => { setFullName(event.target.value); clearFieldError('fullName') }}
                  autoComplete="name"
                  placeholder={text('เช่น สมชาย ใจดี', 'e.g. Alex Smith')}
                  maxLength={255}
                  disabled={saving}
                  aria-invalid={Boolean(formErrors.fullName)}
                  aria-describedby={formErrors.fullName ? 'full-name-error' : undefined}
                  className={`${fieldClassName} ${formErrors.fullName ? 'border-[#d70015]' : 'border-[var(--line)]'}`}
                />
                {formErrors.fullName && <span id="full-name-error" className="mt-2 block text-[12px] font-normal text-[#d70015]">{formErrors.fullName}</span>}
              </label>

              <label className="text-[14px] font-semibold text-[var(--ink)]">
                {text('อีเมลสำหรับเข้าสู่ระบบ', 'Login email')} <span className="text-[#d70015]">*</span>
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
                <label htmlFor="temporary-password">{text('รหัสผ่านชั่วคราว', 'Temporary password')} <span className="text-[#d70015]">*</span></label>
                <div className="relative">
                  <input
                    id="temporary-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); clearFieldError('password') }}
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder={text('อย่างน้อย 10 ตัวอักษร', 'At least 10 characters')}
                    disabled={saving}
                    aria-invalid={Boolean(formErrors.password)}
                    aria-describedby="password-help"
                    className={`${fieldClassName} pr-12 ${formErrors.password ? 'border-[#d70015]' : 'border-[var(--line)]'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={!password || saving}
                    aria-label={showPassword ? text('ซ่อนรหัสผ่าน', 'Hide password') : text('แสดงรหัสผ่าน', 'Show password')}
                    className="absolute right-1.5 top-[14px] inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[#f5f5f7] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
                <div id="password-help" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] font-normal">
                  <span className={formErrors.password ? 'text-[#d70015]' : 'text-[var(--muted)]'}>{formErrors.password ?? text('ความยาว 10–128 ตัวอักษร', '10–128 characters')}</span>
                  <button type="button" onClick={generateTemporaryPassword} disabled={saving} className="inline-flex items-center gap-1.5 font-semibold text-[var(--blue)] hover:underline disabled:opacity-50">
                    <KeyRound size={13} aria-hidden="true" /> {text('สร้างรหัสผ่านให้', 'Generate password')}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[14px] font-semibold text-[var(--ink)]">{text('สิทธิ์การใช้งาน', 'Role')} <span className="text-[#d70015]">*</span></p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3" role="group" aria-label={text('เลือกสิทธิ์สำหรับบัญชีใหม่', 'Select a role for the new account')}>
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
                        <span className="block text-[13px] font-semibold">{text(option.labelTh, option.labelEn)}</span>
                        <span className="mt-1 block text-[11px] font-normal leading-snug text-[var(--muted)]">{text(option.descriptionTh, option.descriptionEn)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetForm} disabled={saving} className="btn-apple-secondary !min-h-11 active:scale-95">{text('ล้างข้อมูล', 'Clear')}</button>
              <button type="submit" disabled={saving} className="btn-apple-primary min-w-40 !min-h-11 active:scale-95">
                {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                {saving ? text('กำลังสร้างบัญชี…', 'Creating account…') : text('สร้างบัญชีผู้ใช้', 'Create account')}
              </button>
            </div>
          </form>
          )}
        </section>

        <section className="surface-card overflow-hidden" aria-labelledby="accounts-title">
          <button type="button" onClick={() => setIsAccountsExpanded((current) => !current)} aria-expanded={isAccountsExpanded} aria-controls="accounts-content" className={`group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[#f8f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--blue)] sm:px-8 ${isAccountsExpanded ? 'border-b border-[var(--line)]' : ''}`}>
            <span className="min-w-0"><span id="accounts-title" className="block text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{text('บัญชีในระบบ', 'System accounts')}</span><span className="mt-1 block text-[14px] text-[var(--muted)]">{text('เปลี่ยนสิทธิ์ หรือเปิดและปิดบัญชีได้จากรายการนี้', 'Change roles or enable and disable accounts here.')}</span></span>
            <span className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--ink)] group-hover:border-[var(--blue)] group-hover:text-[var(--blue)]">{isAccountsExpanded ? text('พับ', 'Collapse') : text('เปิด', 'Expand')}<ChevronDown size={17} className={`transition-transform duration-200 ${isAccountsExpanded ? 'rotate-180' : ''}`} aria-hidden="true" /></span>
          </button>
          {isAccountsExpanded && (
          <div id="accounts-content">
          <div className="border-b border-[var(--line)] px-6 py-4 sm:px-8">
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <label className="relative min-w-0 flex-1 lg:w-72">
                <span className="sr-only">{text('ค้นหาผู้ใช้', 'Search users')}</span>
                <Search size={16} className="pointer-events-none absolute left-4 top-3.5 text-[var(--muted)]" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={text('ค้นหาชื่อหรืออีเมล', 'Search by name or email')}
                  className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white pl-10 pr-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                />
              </label>
              <label>
                <span className="sr-only">{text('กรองตามสิทธิ์', 'Filter by role')}</span>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                  className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white px-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)] sm:w-auto"
                >
                  <option value="all">{text('ทุกสิทธิ์', 'All roles')}</option>
                  {roles.map((option) => <option key={option.value} value={option.value}>{text(option.labelTh, option.labelEn)}</option>)}
                </select>
              </label>
            </div>
          </div>

          {loadError && users.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-[#f0c3c8] bg-[#fff8f8] px-6 py-4 text-[14px] text-[#d70015] sm:flex-row sm:items-center sm:justify-between sm:px-8" role="alert">
              <span className="inline-flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" />{text('รีเฟรชข้อมูลไม่สำเร็จ รายการด้านล่างอาจไม่ใช่ข้อมูลล่าสุด', 'Refresh failed. The list below may be outdated.')}</span>
              <button type="button" onClick={() => void load()} className="font-semibold hover:underline">{text('ลองอีกครั้ง', 'Try again')}</button>
            </div>
          )}

          {loading && users.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
              <Loader2 size={20} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
              {text('กำลังโหลดบัญชี…', 'Loading accounts…')}
            </div>
          ) : loadError && users.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
              <AlertTriangle size={28} className="text-[#d70015]" strokeWidth={1.6} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-[var(--ink)]">{text('โหลดบัญชีไม่สำเร็จ', 'Unable to load accounts')}</p>
              <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">{text('ตรวจสอบการเชื่อมต่อและสิทธิ์ผู้ดูแลระบบแล้วลองอีกครั้ง', 'Check your connection and administrator access, then try again.')}</p>
              <button type="button" onClick={() => void load()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">{text('ลองอีกครั้ง', 'Try again')}</button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <Users size={28} className="text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-[var(--ink)]">{users.length === 0 ? text('ยังไม่มีบัญชีผู้ใช้', 'No user accounts yet') : text('ไม่พบบัญชีที่ค้นหา', 'No matching accounts')}</p>
              <p className="text-[15px] text-[var(--muted)]">{users.length === 0 ? text('สร้างบัญชีแรกได้จากแบบฟอร์มด้านบน', 'Create the first account using the form above.') : text('ลองเปลี่ยนคำค้นหาหรือตัวกรองสิทธิ์', 'Try changing the search or role filter.')}</p>
              {users.length > 0 && (
                <button type="button" onClick={() => { setQuery(''); setRoleFilter('all') }} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">{text('ล้างตัวกรอง', 'Clear filters')}</button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f7] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
                      <th scope="col" className="px-6 py-4 sm:px-8">{text('ผู้ใช้', 'User')}</th>
                      <th scope="col" className="px-6 py-4">{text('สิทธิ์', 'Role')}</th>
                      <th scope="col" className="px-6 py-4">{text('สถานะ', 'Status')}</th>
                      <th scope="col" className="px-6 py-4 sm:pr-8">{text('วันที่สร้าง', 'Created')}</th>
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
                                  {isCurrentUser && <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">{text('บัญชีของคุณ', 'Your account')}</span>}
                                </div>
                                <p className="mt-1 truncate text-[13px] text-[var(--muted)]">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <label className="sr-only" htmlFor={`role-${user.id}`}>{text(`สิทธิ์ของ ${user.full_name}`, `Role for ${user.full_name}`)}</label>
                              <select
                                id={`role-${user.id}`}
                                value={user.role}
                                onChange={(event) => changeRole(user, event.target.value as UserRole)}
                                disabled={isCurrentUser || isUpdating}
                                title={isCurrentUser ? text('ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีที่กำลังใช้งาน', 'You cannot change the role of your current account.') : text('เลือกแล้วระบบจะบันทึกทันที', 'Changes are saved immediately.')}
                                className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:bg-[#f5f5f7] disabled:opacity-60"
                              >
                                {roles.map((option) => <option key={option.value} value={option.value}>{text(option.labelTh, option.labelEn)}</option>)}
                              </select>
                              {isUpdating && <Loader2 size={16} className="animate-spin text-[var(--blue)]" aria-label={text('กำลังบันทึก', 'Saving')} />}
                            </div>
                            {isCurrentUser && <p className="mt-1.5 text-[11px] text-[var(--muted)]">{text('ไม่สามารถแก้ไขสิทธิ์ของบัญชีตัวเองได้', 'You cannot change your own role.')}</p>}
                          </td>
                          <td className="px-6 py-5">
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(user)}
                              disabled={isCurrentUser || isUpdating}
                              aria-label={text(`${user.is_active ? 'ปิด' : 'เปิด'}การใช้งาน ${user.full_name}`, `${user.is_active ? 'Disable' : 'Enable'} ${user.full_name}`)}
                              aria-pressed={user.is_active}
                              title={isCurrentUser ? text('ไม่สามารถปิดบัญชีที่กำลังใช้งาน', 'You cannot disable your current account.') : undefined}
                              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                                user.is_active
                                  ? 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                                  : 'border-[#f0c3c8] bg-[#fff8f8] text-[#d70015]'
                              }`}
                            >
                              {isUpdating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
                              {user.is_active ? text('ใช้งานอยู่', 'Active') : text('ปิดใช้งาน', 'Inactive')}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-6 py-5 text-[13px] text-[var(--muted)] sm:pr-8">
                            {new Date(user.created_at).toLocaleString(isThai ? 'th-TH' : 'en-US', {
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
                <span>{text(`แสดง ${filteredUsers.length} จาก ${users.length} บัญชี`, `Showing ${filteredUsers.length} of ${users.length} accounts`)}</span>
                <span>{text('การเปลี่ยนสิทธิ์และสถานะจะบันทึกทันที', 'Role and status changes are saved immediately.')}</span>
              </div>
            </>
          )}
          </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
