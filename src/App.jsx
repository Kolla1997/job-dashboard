import { useState, useEffect, useCallback } from 'react'
import { Briefcase, KanbanSquare, RefreshCw, AlertCircle } from 'lucide-react'
import JobBoard from './components/JobBoard'
import Kanban from './components/Kanban'
import StatsBar from './components/StatsBar'
import { fetchJobs } from './lib/supabase'
import './index.css'

const C = {
  bg:        '#FAF7F0',
  card:      '#F5F0E8',
  hover:     '#EDE8DE',
  border:    '#E0D8CC',
  borderHov: '#C8B8A8',
  textPri:   '#1A0800',
  textSec:   '#4A2810',
  textMut:   '#8A6A50',
  primary:   '#A52700',
  primaryTx: '#FAF7F0',
  primHov:   '#8A2000',
}

const NAV = [
  { id: 'board',  label: 'Job Board', icon: Briefcase },
  { id: 'kanban', label: 'Kanban',    icon: KanbanSquare },
]

export default function App() {
  const [view, setView]    = useState('board')
  const [jobs, setJobs]    = useState([])
  const [loading, setLoad] = useState(true)
  const [error, setError]  = useState('')

  const loadJobs = useCallback(async () => {
    setLoad(true); setError('')
    try   { setJobs((await fetchJobs()) || []) }
    catch (err) { setError(err.message) }
    finally { setLoad(false) }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg }}>

      {/* ── SIDEBAR ── */}
      <aside className="w-60 shrink-0 flex flex-col overflow-y-auto"
        style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}>

        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: C.primary }}>
              <Briefcase size={15} style={{ color: C.primaryTx }} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: C.textPri }}>Job Pipeline</p>
              <p className="text-[10px]" style={{ color: C.textMut }}>Track your search</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = view === id
            return (
              <button key={id} onClick={() => setView(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border"
                style={active
                  ? { background: C.primary, color: C.primaryTx, borderColor: C.primary }
                  : { background: 'transparent', color: C.textSec, borderColor: 'transparent' }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.hover }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={16} /> {label}
              </button>
            )
          })}
        </nav>

        {/* Refresh */}
        <div className="px-3 mb-4">
          <button onClick={loadJobs} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-xl transition-all disabled:opacity-40"
            style={{ background: C.card, color: C.textMut, border: `1px solid ${C.border}` }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMut }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh Jobs'}
          </button>
        </div>

        <div className="mx-4 mb-4" style={{ borderTop: `1px solid ${C.border}` }} />

        {/* Stats */}
        <div className="px-3 pb-6 flex-1">
          <p className="text-[10px] uppercase tracking-wider px-1 mb-3" style={{ color: C.textMut }}>
            Pipeline Stats
          </p>
          <StatsBar jobs={jobs} />
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3.5 shrink-0 flex items-center"
          style={{ borderBottom: `1px solid ${C.border}`, background: `${C.bg}F8` }}>
          <div>
            <h1 className="text-base font-semibold" style={{ color: C.textPri }}>
              {view === 'board' ? 'Job Board' : 'Kanban Board'}
            </h1>
            <p className="text-xs" style={{ color: C.textMut }}>{jobs.length} jobs in pipeline</p>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl p-3 text-sm flex items-center gap-2"
            style={{ background: 'rgba(180,30,30,0.08)', border: '1px solid rgba(180,30,30,0.2)', color: '#B41E1E' }}>
            <AlertCircle size={15} /> Failed to load: {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view === 'board'  && <JobBoard jobs={jobs} setJobs={setJobs} loading={loading} onRefresh={loadJobs} />}
          {view === 'kanban' && <Kanban   jobs={jobs} setJobs={setJobs} />}
        </div>
      </main>
    </div>
  )
}
