import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ShieldCheck, UserCog, Users } from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { adminService } from '../services/admin'
import { useAuthStore } from '../stores/authStore'
import type { User } from '../types'

type Role = 'admin' | 'safety_officer' | 'viewer'

const fieldClassName = 'mt-2 min-h-12 w-full rounded-[11px] border border-[var(--line)] bg-white px-4 text-[15px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50'

export function AdminUsersPage() {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('viewer')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setUsers(await adminService.listUsers())
    } catch (error) {
      console.error(error)
      setLoadError(true)
      toast.error('โหลดผู้ใช้ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const createUser = async () => {
    if (!email || !fullName || password.length < 10) {
      toast.error('กรอกข้อมูลให้ครบและใช้รหัสผ่านอย่างน้อย 10 ตัวอักษร')
      return
    }
    setSaving(true)
    try {
      await adminService.createUser({ email, full_name: fullName, password, role })
      setEmail('')
      setFullName('')
      setPassword('')
      setRole('viewer')
      toast.success('สร้างบัญชีแล้ว')
      await load()
    } catch (error) {
      console.error(error)
      toast.error('สร้างบัญชีไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const update = async (user: User, payload: Partial<Pick<User, 'role' | 'is_active'>>) => {
    try {
      const updated = await adminService.updateUser(user.id, payload)
      setUsers((current) => current.map((item) => item.id === user.id ? updated : item))
      toast.success('อัปเดตสิทธิ์แล้ว')
    } catch (error) {
      console.error(error)
      toast.error('อัปเดตผู้ใช้ไม่สำเร็จ')
    }
  }

  return (
    <Layout>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 sm:gap-10">
        <header className="page-heading flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-white" aria-hidden="true">
              <UserCog size={20} strokeWidth={1.8} />
            </div>
            <h1>User Management</h1>
            <p className="max-w-2xl !mt-3 !text-[17px] !leading-[1.47]">
              สร้างบัญชีและกำหนดสิทธิ์ตามหน้าที่ในโรงงาน
            </p>
          </div>
          <div className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-[14px] text-[var(--muted)]">
            <Users size={16} aria-hidden="true" />
            <span><strong className="font-semibold text-[var(--ink)]">{users.length}</strong> accounts</span>
          </div>
        </header>

        <section className="surface-card p-6 sm:p-8" aria-labelledby="create-user-title">
          <div className="mb-7">
            <h2 id="create-user-title" className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              <Plus size={19} className="text-[var(--blue)]" aria-hidden="true" />
              Create user
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Create a temporary account and assign the appropriate access level.</p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-[14px] font-semibold text-[var(--ink)]">
              Full name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                className={fieldClassName}
              />
            </label>
            <label className="text-[14px] font-semibold text-[var(--ink)]">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className={fieldClassName}
              />
            </label>
            <label className="text-[14px] font-semibold text-[var(--ink)]">
              Temporary password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={10}
                autoComplete="new-password"
                className={fieldClassName}
              />
              <span className="mt-2 block text-[12px] font-normal text-[var(--muted)]">At least 10 characters</span>
            </label>
            <label className="text-[14px] font-semibold text-[var(--ink)]">
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className={fieldClassName}
              >
                <option value="viewer">Viewer</option>
                <option value="safety_officer">Safety officer</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void createUser()}
              className="btn-apple-primary min-w-36 !min-h-11 active:scale-95"
            >
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </section>

        <section className="surface-card overflow-hidden" aria-labelledby="accounts-title">
          <div className="flex min-h-16 items-center justify-between border-b border-[var(--line)] px-6 sm:px-8">
            <h2 id="accounts-title" className="text-[21px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Accounts</h2>
            <span className="rounded-full bg-[#f5f5f7] px-4 py-2 text-[13px] text-[var(--muted)]">{users.length} total</span>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-[15px] text-[var(--muted)]" role="status">
              <Loader2 size={20} className="animate-spin text-[var(--blue)]" aria-hidden="true" />
              Loading accounts…
            </div>
          ) : loadError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
              <p className="text-[17px] font-semibold text-[var(--ink)]">Unable to load accounts</p>
              <p className="max-w-md text-[15px] leading-relaxed text-[var(--muted)]">Check the connection and try loading this list again.</p>
              <button type="button" onClick={() => void load()} className="btn-apple-secondary !min-h-11 text-[var(--blue)]">Try again</button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <Users size={28} className="text-[var(--muted)]" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[17px] font-semibold text-[var(--ink)]">No accounts yet</p>
              <p className="text-[15px] text-[var(--muted)]">Create the first managed user with the form above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f7] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
                    <th scope="col" className="px-6 py-4 sm:px-8">User</th>
                    <th scope="col" className="px-6 py-4">Role</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4 sm:pr-8">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-[var(--line)] transition-colors hover:bg-[#fafafc]">
                      <td className="px-6 py-5 sm:px-8">
                        <p className="text-[16px] font-semibold text-[var(--ink)]">{user.full_name}</p>
                        <p className="mt-1 text-[14px] text-[var(--muted)]">{user.email}</p>
                      </td>
                      <td className="px-6 py-5">
                        <label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.full_name}</label>
                        <select
                          id={`role-${user.id}`}
                          value={user.role}
                          onChange={(event) => void update(user, { role: event.target.value })}
                          disabled={user.id === currentUserId}
                          title={user.id === currentUserId ? 'ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีที่กำลังใช้งาน' : undefined}
                          className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--blue)]"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="safety_officer">Safety officer</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() => void update(user, { is_active: !user.is_active })}
                          disabled={user.id === currentUserId}
                          aria-label={`${user.is_active ? 'Deactivate' : 'Activate'} ${user.full_name}`}
                          aria-pressed={user.is_active}
                          title={user.id === currentUserId ? 'ไม่สามารถปิดบัญชีที่กำลังใช้งาน' : undefined}
                          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                            user.is_active
                              ? 'border-[#b9dfc2] bg-[#f3fbf5] text-[#15803d]'
                              : 'border-[#f0c3c8] bg-[#fff8f8] text-[#d70015]'
                          }`}
                        >
                          <ShieldCheck size={14} aria-hidden="true" />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-5 text-[14px] text-[var(--muted)] sm:pr-8">
                        {new Date(user.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
