import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ShieldCheck, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'

import { Layout } from '../components/layout/Layout'
import { adminService } from '../services/admin'
import type { User } from '../types'

type Role = 'admin' | 'safety_officer' | 'viewer'

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('viewer')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await adminService.listUsers())
    } catch (error) {
      console.error(error)
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
      <div className="space-y-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0f172a] m-0 flex items-center gap-2"><UserCog size={22} className="text-[#2563eb]" /> User Management</h1>
          <p className="text-[13px] text-[#64748b] mt-1">สร้างบัญชีและกำหนดสิทธิ์ตามหน้าที่ในโรงงาน</p>
        </div>

        <section className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <h2 className="text-[15px] font-bold text-[#0f172a] mt-0 mb-4 flex items-center gap-2"><Plus size={16} /> Create user</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <label className="text-[12px] font-semibold text-[#64748b]">Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 w-full box-border px-3 py-2.5 border border-[#dbe3ee] rounded-lg" /></label>
            <label className="text-[12px] font-semibold text-[#64748b]">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full box-border px-3 py-2.5 border border-[#dbe3ee] rounded-lg" /></label>
            <label className="text-[12px] font-semibold text-[#64748b]">Temporary password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full box-border px-3 py-2.5 border border-[#dbe3ee] rounded-lg" /></label>
            <label className="text-[12px] font-semibold text-[#64748b]">Role<select value={role} onChange={(event) => setRole(event.target.value as Role)} className="mt-1.5 w-full box-border px-3 py-2.5 border border-[#dbe3ee] rounded-lg bg-white"><option value="viewer">Viewer</option><option value="safety_officer">Safety officer</option><option value="admin">Administrator</option></select></label>
            <button disabled={saving} onClick={() => void createUser()} className="h-[42px] flex justify-center items-center gap-2 px-4 bg-[#2563eb] text-white border-none rounded-lg font-semibold cursor-pointer disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create</button>
          </div>
        </section>

        <section className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#f1f5f9] font-bold text-[#0f172a]">Accounts ({users.length})</div>
          {loading ? <div className="py-16 flex justify-center text-[#64748b]"><Loader2 className="animate-spin mr-2" /> Loading...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr className="bg-[#f8fafc] text-left text-[11px] uppercase text-[#94a3b8]"><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th></tr></thead>
                <tbody>{users.map((user) => (
                  <tr key={user.id} className="border-t border-[#f1f5f9]">
                    <td className="px-5 py-4"><p className="text-[14px] font-semibold text-[#0f172a] m-0">{user.full_name}</p><p className="text-[12px] text-[#64748b] mt-1 mb-0">{user.email}</p></td>
                    <td className="px-5 py-4"><select value={user.role} onChange={(event) => void update(user, { role: event.target.value })} className="border border-[#dbe3ee] rounded-lg px-2.5 py-2 bg-white text-[13px]"><option value="viewer">Viewer</option><option value="safety_officer">Safety officer</option><option value="admin">Administrator</option></select></td>
                    <td className="px-5 py-4"><button onClick={() => void update(user, { is_active: !user.is_active })} className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-none rounded-full text-[11px] font-bold cursor-pointer ${user.is_active ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}><ShieldCheck size={12} />{user.is_active ? 'ACTIVE' : 'INACTIVE'}</button></td>
                    <td className="px-5 py-4 text-[12px] text-[#64748b]">{new Date(user.created_at).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
