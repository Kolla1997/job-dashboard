import { useState, useMemo } from 'react'
import { Search, X, RefreshCw, SlidersHorizontal } from 'lucide-react'
import JobCard from './JobCard'
import JobDetail from './JobDetail'
import { updateJobStatus } from '../lib/supabase'

const TODAY = new Date().toISOString().split('T')[0]

const STATUS_SEGMENTS = [
  { value: 'today',     label: 'Today',     today: true },
  { value: 'all',       label: 'All' },
  { value: 'tailored',  label: 'Ready' },
  { value: 'applied',   label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer',     label: 'Offer' },
  { value: 'accepted',  label: 'Accepted' },
  { value: 'rejected',  label: 'Rejected' },
]

const SORT_OPTIONS = [
  { value: 'score_desc',  label: 'Score ↓' },
  { value: 'score_asc',   label: 'Score ↑' },
  { value: 'date_desc',   label: 'Newest' },
  { value: 'date_asc',    label: 'Oldest' },
  { value: 'company_asc', label: 'Company A–Z' },
]

const SCORE_FILTERS = [
  { label: 'All', min: 0 },
  { label: '80+', min: 80 },
  { label: '70+', min: 70 },
  { label: '60+', min: 60 },
]

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A2810' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`

function sortJobs(jobs, key) {
  const c = [...jobs]
  switch (key) {
    case 'score_desc':  return c.sort((a, b) => (b.fit_score||0) - (a.fit_score||0))
    case 'score_asc':   return c.sort((a, b) => (a.fit_score||0) - (b.fit_score||0))
    case 'date_desc':   return c.sort((a, b) => new Date(b.created_at||0) - new Date(a.created_at||0))
    case 'date_asc':    return c.sort((a, b) => new Date(a.created_at||0) - new Date(b.created_at||0))
    case 'company_asc': return c.sort((a, b) => (a.company||'').localeCompare(b.company||''))
    default: return c
  }
}

export default function JobBoard({ jobs, setJobs, loading, onRefresh }) {
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatus]      = useState('today')
  const [scoreMin,     setScoreMin]    = useState(0)
  const [sort,         setSort]        = useState('score_desc')
  const [selectedJob,  setSelectedJob] = useState(null)

  // "today" counts as an active filter only for the badge count (not for "All")
  const activeFilters = (statusFilter !== 'all' && statusFilter !== 'today' ? 1 : 0) +
                        (scoreMin > 0 ? 1 : 0) + (search ? 1 : 0)

  const filtered = useMemo(() => {
    let list = jobs.filter(job => {
      // Today filter
      if (statusFilter === 'today') {
        if (!job.created_at) return false
        return job.created_at.split('T')[0] === TODAY
      }
      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) return false
      return true
    })

    // Score filter
    list = list.filter(job => (job.fit_score || 0) >= scoreMin)

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(job =>
        job.job_title?.toLowerCase().includes(q) ||
        job.company?.toLowerCase().includes(q) ||
        job.location?.toLowerCase().includes(q)
      )
    }

    return sortJobs(list, sort)
  }, [jobs, statusFilter, scoreMin, search, sort])

  const handleCardUpdate = (jobId, updates) => {
    setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, ...updates } : j))
    if (selectedJob?.job_id === jobId) setSelectedJob(prev => ({ ...prev, ...updates }))
  }
  const handleStatusChange = async (jobId, status) => {
    await updateJobStatus(jobId, status)
    handleCardUpdate(jobId, { status })
  }

  const segStyle = (active) => active
    ? { background: '#A52700', color: '#FAF7F0', border: '1px solid #A52700' }
    : { background: 'transparent', color: '#4A2810', border: '1px solid transparent' }

  const scoreStyle = (active) => active
    ? { background: '#A52700', color: '#FAF7F0', border: '1px solid #A52700' }
    : { background: 'transparent', color: '#4A2810', border: '1px solid transparent' }

  // Empty state for Today filter specifically
  const isTodayEmpty = !loading && statusFilter === 'today' && filtered.length === 0

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8A6A50' }} />
          <input type="text" placeholder="Search company, title, location…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="text-sm rounded-xl pl-8 pr-8 py-2.5 w-72 focus:outline-none transition-colors"
            style={{ background: '#F5F0E8', border: '1px solid #E0D8CC', color: '#1A0800' }}
            onFocus={e  => e.target.style.borderColor = '#A52700'}
            onBlur={e   => e.target.style.borderColor = '#E0D8CC'} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: '#8A6A50' }}
              onMouseEnter={e => e.currentTarget.style.color = '#A52700'}
              onMouseLeave={e => e.currentTarget.style.color = '#8A6A50'}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status segments */}
        <div className="flex rounded-xl p-1 gap-0.5"
          style={{ background: '#F5F0E8', border: '1px solid #E0D8CC' }}>
          {STATUS_SEGMENTS.map(s => {
            const active = statusFilter === s.value
            return (
              <button key={s.value} onClick={() => setStatus(s.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center"
                style={segStyle(active)}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#A52700'; e.currentTarget.style.borderColor = '#A52700' }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#4A2810'; e.currentTarget.style.borderColor = 'transparent' }}}>
                {s.today && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1.5 animate-pulse shrink-0" />
                )}
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Score filter */}
        <div className="flex rounded-xl p-1 gap-0.5"
          style={{ background: '#F5F0E8', border: '1px solid #E0D8CC' }}>
          {SCORE_FILTERS.map(f => (
            <button key={f.label} onClick={() => setScoreMin(f.min)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={scoreStyle(scoreMin === f.min)}
              onMouseEnter={e => { if (scoreMin !== f.min) { e.currentTarget.style.color = '#A52700'; e.currentTarget.style.borderColor = '#A52700' }}}
              onMouseLeave={e => { if (scoreMin !== f.min) { e.currentTarget.style.color = '#4A2810'; e.currentTarget.style.borderColor = 'transparent' }}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort + badge */}
        <div className="flex items-center gap-2 ml-auto">
          {activeFilters > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
              style={{ background: '#A52700', color: '#FAF7F0' }}>
              <SlidersHorizontal size={10} />
              {activeFilters} filter{activeFilters > 1 ? 's' : ''}
            </span>
          )}
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-xs rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer appearance-none pr-7"
            style={{ background: '#F5F0E8', border: '1px solid #E0D8CC', color: '#4A2810',
              backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ background: '#FAF7F0' }}>{o.label}</option>
            ))}
          </select>
          <span className="text-xs" style={{ color: '#C8B8A8' }}>{filtered.length} jobs</span>
        </div>
      </div>

      {/* Grid / empty states */}
      {loading ? (
        <div className="flex items-center justify-center py-24" style={{ color: '#C8B8A8' }}>
          <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : isTodayEmpty ? (
        <div className="text-center py-20">
          <p className="text-2xl mb-2">🔍</p>
          <p className="font-medium" style={{ color: '#1A0800' }}>No new jobs today</p>
          <p className="text-sm mt-1" style={{ color: '#8A6A50' }}>
            Run the pipeline to scrape fresh jobs, or switch to "All" to see everything
          </p>
          <button
            onClick={() => setStatus('all')}
            className="mt-4 px-4 py-2 text-sm rounded-lg transition-colors"
            style={{ background: '#A52700', color: '#FAF7F0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#8A2000'}
            onMouseLeave={e => e.currentTarget.style.background = '#A52700'}>
            View All Jobs
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: '#C8B8A8' }}>
          <Search size={32} className="mb-3 opacity-50" />
          <p className="text-sm">No jobs match your filters</p>
          <button onClick={() => { setSearch(''); setStatus('today'); setScoreMin(0) }}
            className="mt-3 text-xs underline" style={{ color: '#A52700' }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map(job => (
            <JobCard key={job.job_id} job={job} onUpdate={handleCardUpdate} onOpenDetail={setSelectedJob} />
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  )
}
