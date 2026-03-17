import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { detectionService } from '../services/detection'
import type { Detection } from '../types'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  FileText,
  Download,
  Eye,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

export function HistoryPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)

  useEffect(() => { loadHistory() }, [page])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await detectionService.getHistory(page, 12)
      setDetections(data.items || [])
      setTotalPages(data.total_pages || 1)
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const violationCount = detections.filter(d => d.has_violation).length
  const complianceCount = detections.filter(d => !d.has_violation).length

  // ─── Shared styles ────────────────────────────────────────────────────────
  const card = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5eaf0',
    borderRadius: '16px',
    overflow: 'hidden' as const,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }

  const thStyle = {
    padding: '11px 16px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    textAlign: 'left' as const,
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e5eaf0',
  }

  const tdStyle = {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle' as const,
  }

  if (loading && detections.length === 0) {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #e5eaf0', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Loading records...</span>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Header ── */}
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="#2563eb" />
            Safety Reports &amp; Analytics
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Detection history and safety compliance records</p>
        </div>

        {/* ── Summary stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {/* Violations */}
          <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={22} color="#dc2626" />
            </div>
            <div>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1 }}>{violationCount}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>Total Violations</p>
            </div>
          </div>
          {/* Compliant */}
          <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={22} color="#16a34a" />
            </div>
            <div>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1 }}>{complianceCount}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>Compliant</p>
            </div>
          </div>
          {/* Total records */}
          <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={22} color="#2563eb" />
            </div>
            <div>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1 }}>{total}</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>Total Records</p>
            </div>
          </div>
        </div>

        {/* ── Detection Records Table ── */}
        {detections.length === 0 && !loading ? (
          <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
            <Clock size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#475569', margin: '0 0 6px' }}>No detection records yet</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Detection results will appear here after running the system.</p>
          </div>
        ) : (
          <div style={card}>
            {/* Table header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5eaf0' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Detection Records</h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{total} records</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Thumbnail</th>
                    <th style={thStyle}>Date &amp; Time</th>
                    <th style={thStyle}>Persons</th>
                    <th style={thStyle}>Violations</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((detection, idx) => (
                    <tr
                      key={detection.id}
                      style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f6ff')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafbfc')}
                    >
                      {/* Thumbnail */}
                      <td style={tdStyle}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5eaf0', backgroundColor: '#f1f5f9', flexShrink: 0 }}>
                          <img
                            src={detectionService.getResultImageUrl(detection.id)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td style={tdStyle}>
                        {new Date(detection.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>

                      {/* Persons */}
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Users size={14} color="#94a3b8" />
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{detection.person_count}</span>
                        </span>
                      </td>

                      {/* Violations chips */}
                      <td style={tdStyle}>
                        {detection.violations && detection.violations.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {detection.violations.slice(0, 2).map((v, i) => (
                              <span key={i} style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid #fecaca' }}>
                                {v}
                              </span>
                            ))}
                            {detection.violations.length > 2 && (
                              <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '11px', borderRadius: '6px' }}>
                                +{detection.violations.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td style={tdStyle}>
                        {detection.has_violation ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: '1px solid #fecaca' }}>
                            <ShieldAlert size={13} /> Violation
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                            <ShieldCheck size={13} /> Compliant
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Download */}
                          <button
                            onClick={e => { e.stopPropagation(); window.open(detectionService.getResultImageUrl(detection.id), '_blank') }}
                            title="Download"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5eaf0', backgroundColor: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#eff6ff'; (e.currentTarget as HTMLButtonElement).style.color = '#2563eb' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
                          >
                            <Download size={14} />
                          </button>
                          {/* View Detail */}
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedDetection(detection) }}
                            title="View Detail"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5eaf0', backgroundColor: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#eff6ff'; (e.currentTarget as HTMLButtonElement).style.color = '#2563eb' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5eaf0', backgroundColor: '#ffffff', color: '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', padding: '6px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e5eaf0' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5eaf0', backgroundColor: '#ffffff', color: '#64748b', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Detail Modal ── */}
        {selectedDetection && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            {/* Backdrop */}
            <div
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSelectedDetection(null)}
            />
            {/* Modal */}
            <div style={{ position: 'relative', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e5eaf0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Detection Detail</h2>
                <button
                  onClick={() => setSelectedDetection(null)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Result image */}
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5eaf0', backgroundColor: '#f8fafc' }}>
                  <img
                    src={detectionService.getResultImageUrl(selectedDetection.id)}
                    alt="Result"
                    style={{ width: '100%', maxHeight: '45vh', objectFit: 'contain' }}
                  />
                </div>

                {/* Status banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderRadius: '12px', backgroundColor: selectedDetection.has_violation ? '#fff1f2' : '#f0fdf4', border: `1px solid ${selectedDetection.has_violation ? '#fecaca' : '#bbf7d0'}` }}>
                  {selectedDetection.has_violation
                    ? <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                    : <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                  }
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: selectedDetection.has_violation ? '#dc2626' : '#16a34a', margin: '0 0 2px' }}>
                      {selectedDetection.has_violation ? 'Safety Violation Detected' : 'Fully Compliant — No Violations'}
                    </p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      {new Date(selectedDetection.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                  {[
                    { icon: <Users size={18} color="#2563eb" />, label: 'Persons', value: selectedDetection.person_count, valueColor: '#0f172a' },
                    { icon: <AlertTriangle size={18} color={selectedDetection.violation_count > 0 ? '#dc2626' : '#94a3b8'} />, label: 'Violations', value: selectedDetection.violation_count, valueColor: selectedDetection.violation_count > 0 ? '#dc2626' : '#0f172a' },
                    { icon: <Clock size={18} color="#0ea5e9" />, label: 'Processing', value: `${selectedDetection.processing_time_ms ?? '—'}ms`, valueColor: '#0f172a' },
                  ].map((s, i) => (
                    <div key={i} style={{ backgroundColor: '#f8fafc', border: '1px solid #e5eaf0', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>{s.icon}</div>
                      <p style={{ fontSize: '22px', fontWeight: 700, color: s.valueColor, margin: '0 0 2px' }}>{s.value}</p>
                      <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Violations list */}
                {selectedDetection.violations && selectedDetection.violations.length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Violations Found</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedDetection.violations.map((v, i) => (
                        <span key={i} style={{ padding: '4px 12px', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: '1px solid #fecaca' }}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-person breakdown */}
                {selectedDetection.persons && selectedDetection.persons.length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Per-Person PPE Status</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedDetection.persons.map((person) => (
                        <div key={person.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: person.is_compliant ? '#f0fdf4' : '#fff1f2', border: `1px solid ${person.is_compliant ? '#bbf7d0' : '#fecaca'}`, borderRadius: '10px' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>Person {person.id}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {person.wearing?.map((item, i) => (
                                <span key={`w${i}`} style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <CheckCircle size={11} /> {item}
                                </span>
                              ))}
                              {person.not_wearing?.map((item, i) => (
                                <span key={`nw${i}`} style={{ fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <X size={11} /> {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', backgroundColor: person.is_compliant ? '#dcfce7' : '#fee2e2', color: person.is_compliant ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                            {Math.round(person.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  )
}
