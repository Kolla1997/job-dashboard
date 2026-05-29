import { useState } from 'react'
import { X, Download, Zap, MapPin, Briefcase, DollarSign, Calendar, ExternalLink } from 'lucide-react'
import { compareResumeToJD } from '../lib/deepseek'
import { updateJobStatus, markApplied } from '../lib/supabase'
import { downloadResume } from '../lib/downloadResume'
import { useApplyFlow } from '../hooks/useApplyFlow'
import ApplyPopup from './ApplyPopup'
import ResumeDocument from './ResumeDocument'

const STATUS_OPTIONS = ['new','scored','tailored','applied','screening','interview','offer','accepted','rejected','withdrawn']
const AVATAR_COLORS  = ['#A52700','#8A2000','#C86A00','#4A2810','#7A3A10','#5A2008','#6A4828','#3A1A08','#B45A00']

function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name) {
  if (!name) return '??'
  const w = name.trim().split(/\s+/)
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function ScoreRing({ score, size = 80 }) {
  const sw = 7, r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E0D8CC" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#A52700" strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dy="0.35em"
        fill="#A52700" fontSize={size * 0.2} fontWeight="700" fontFamily="system-ui">
        {score}%
      </text>
    </svg>
  )
}

function FitBadge({ level }) {
  if (!level) return null
  const map = {
    'strong fit':  { bg: 'rgba(165,39,0,0.1)',   text: '#A52700', border: 'rgba(165,39,0,0.25)' },
    'good fit':    { bg: 'rgba(200,106,0,0.1)',   text: '#C86A00', border: 'rgba(200,106,0,0.25)' },
    'partial fit': { bg: 'rgba(232,160,32,0.15)', text: '#A57800', border: 'rgba(232,160,32,0.3)' },
    'weak fit':    { bg: 'rgba(180,30,30,0.1)',   text: '#B41E1E', border: 'rgba(180,30,30,0.25)' },
  }
  const s = map[level.toLowerCase()] || { bg: '#EDE8DE', text: '#4A2810', border: '#E0D8CC' }
  return (
    <span className="text-xs font-semibold px-3 py-1 rounded-full border capitalize"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      {level}
    </span>
  )
}

function TechChips({ text }) {
  if (!text) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {text.split(/[,;|\n]/).map(s => s.trim()).filter(Boolean).map((chip, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-md"
          style={{ background: '#EDE8DE', border: '1px solid #E0D8CC', color: '#4A2810' }}>
          {chip}
        </span>
      ))}
    </div>
  )
}


function TypeBadge({ type }) {
  const styles = {
    added:     'bg-green-100 text-green-700',
    modified:  'bg-blue-100 text-blue-700',
    reordered: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  )
}

function AIComparePanel({ job }) {
  const [comparison, setComparison] = useState(null)
  const [analyzing,  setAnalyzing]  = useState(false)
  const [error,      setError]      = useState('')

  const handleCompare = async () => {
    setAnalyzing(true); setError(''); setComparison(null)
    try {
      const jd = [job.requirements_summary, job.tech_tools ? `Tech/Tools: ${job.tech_tools}` : ''].filter(Boolean).join('\n\n')
      const result = await compareResumeToJD({
        jobTitle: job.job_title, company: job.company, jd,
        originalResumeText: job.original_resume_text || '',
        tailoredResumeText: job.tailored_resume_text  || '',
      })
      setComparison(result)
    } catch (err) { setError(err.message) }
    finally { setAnalyzing(false) }
  }

  if (!comparison && !analyzing && !error) return (
    <div className="flex flex-col items-center justify-center h-full gap-5 py-16">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(165,39,0,0.08)', border: '1px solid rgba(165,39,0,0.2)' }}>
        <Zap size={28} style={{ color: '#A52700' }} />
      </div>
      <div className="text-center">
        <p className="font-semibold mb-1" style={{ color: '#1A0800' }}>AI Resume Comparison</p>
        <p className="text-sm max-w-xs" style={{ color: '#8A6A50' }}>
          DeepSeek will compare your original and tailored resumes against this job description.
        </p>
      </div>
      <button onClick={handleCompare}
        className="flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-colors"
        style={{ background: '#A52700', color: '#FAF7F0' }}
        onMouseEnter={e => e.currentTarget.style.background = '#8A2000'}
        onMouseLeave={e => e.currentTarget.style.background = '#A52700'}>
        <Zap size={16} /> Compare Resumes
      </button>
    </div>
  )

  if (analyzing) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
      <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#A52700', borderTopColor: 'transparent' }} />
      <p className="text-sm" style={{ color: '#8A6A50' }}>DeepSeek is analyzing your resumes…</p>
    </div>
  )

  if (error) return (
    <div className="p-4 space-y-3">
      <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(180,30,30,0.08)', border: '1px solid rgba(180,30,30,0.2)', color: '#B41E1E' }}>
        {error}
      </div>
      <button onClick={handleCompare} className="text-sm" style={{ color: '#A52700' }}>Try again</button>
    </div>
  )

  const changes = comparison.changes || []

  return (
    <div>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs italic" style={{ color: '#C8B8A8' }}>AI-generated — review before acting on it</p>
        <button onClick={() => setComparison(null)} className="text-xs" style={{ color: '#8A6A50' }}>Reset</button>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(165,39,0,0.08)', border: '1px solid rgba(165,39,0,0.2)' }}>
        <p className="font-medium text-sm" style={{ color: '#A52700' }}>{comparison.summary}</p>
        <div className="flex gap-4 mt-2 text-sm" style={{ color: '#4A2810' }}>
          <span>Match Score: <strong>{comparison.match_score}/100</strong></span>
          <span>{changes.length} change{changes.length !== 1 ? 's' : ''} made</span>
        </div>
      </div>

      {/* Change cards */}
      {changes.map((change, i) => (
        <div key={i} className="rounded-xl p-4 mb-3" style={{ background: '#FFFFFF', border: '1px solid #E0D8CC' }}>
          <div className="flex gap-2 mb-3">
            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(165,39,0,0.1)', color: '#A52700' }}>
              {change.section}
            </span>
            <TypeBadge type={change.type} />
          </div>

          {change.original && (
            <div className="mb-2">
              <p className="text-xs mb-1" style={{ color: '#8A6A50' }}>BEFORE</p>
              <p className="text-sm rounded p-2 line-through opacity-70"
                style={{ background: '#FEF2F2', color: '#4A2810' }}>
                {change.original}
              </p>
            </div>
          )}

          <div className="mb-2">
            <p className="text-xs mb-1" style={{ color: '#8A6A50' }}>AFTER</p>
            <p className="text-sm rounded p-2" style={{ background: '#F0FDF4', color: '#1A0800' }}>
              {change.tailored}
            </p>
          </div>

          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #E0D8CC' }}>
            <p className="text-xs" style={{ color: '#8A6A50' }}>WHY IT HELPS</p>
            <p className="text-sm italic mt-1" style={{ color: '#4A2810' }}>{change.reason}</p>
          </div>
        </div>
      ))}

      {/* Key improvements */}
      {comparison.key_improvements?.length > 0 && (
        <div className="mt-4 p-4 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p className="text-sm font-bold mb-2" style={{ color: '#166534' }}>KEY IMPROVEMENTS</p>
          {comparison.key_improvements.map((item, i) => (
            <p key={i} className="text-sm" style={{ color: '#15803D' }}>✓ {item}</p>
          ))}
        </div>
      )}

      {/* Remaining gaps */}
      {comparison.remaining_gaps?.length > 0 && (
        <div className="mt-3 p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <p className="text-sm font-bold mb-2" style={{ color: '#9A3412' }}>REMAINING GAPS</p>
          {comparison.remaining_gaps.map((item, i) => (
            <p key={i} className="text-sm" style={{ color: '#C2410C' }}>⚠ {item}</p>
          ))}
        </div>
      )}
    </div>
  )
}

const TABS = ['Original Resume', 'Tailored Resume', 'AI Compare']
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A2810' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`

export default function JobDetail({ job: initialJob, onClose, onStatusChange }) {
  const [job,    setJob]    = useState(initialJob)
  const [tab,    setTab]    = useState('AI Compare')
  const [status, setStatus] = useState(job.status || 'new')
  const { pending, trigger, dismiss } = useApplyFlow()

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus); setJob(j => ({ ...j, status: newStatus }))
    await onStatusChange(job.job_id, newStatus)
  }
  const handleConfirmApply = async () => {
    await markApplied(job.job_id)
    const upd = { status: 'applied', applied_at: new Date().toISOString() }
    setJob(j => ({ ...j, ...upd })); setStatus('applied')
    await onStatusChange(job.job_id, 'applied')
  }

  const color = avatarColor(job.company)
  const score = job.fit_score || 0

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)', padding: 16 }}
        onClick={onClose}>
        <div className="flex overflow-hidden"
          style={{
            width: '95vw',
            maxWidth: 1400,
            height: '92vh',
            background: '#FAF7F0',
            border: '1px solid #E0D8CC',
            borderRadius: 16,
            boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
            margin: 'auto',
            position: 'relative',
          }}
          onClick={e => e.stopPropagation()}>

          {/* ── LEFT PANEL ── */}
          <div className="w-[35%] flex flex-col overflow-y-auto"
            style={{ background: '#F5F0E8', borderRight: '1px solid #E0D8CC' }}>

            <div className="p-6 pb-0">
              <div className="flex items-start justify-between mb-5">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
                  style={{ backgroundColor: color, color: '#FAF7F0' }}>
                  {initials(job.company)}
                </div>
                <button onClick={onClose} className="p-2 rounded-lg transition-colors"
                  style={{ color: '#8A6A50' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE8DE'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={16} />
                </button>
              </div>

              <h2 className="text-xl font-bold leading-tight mb-1" style={{ color: '#1A0800' }}>{job.job_title}</h2>
              <p className="text-sm mb-4" style={{ color: '#4A2810' }}>{job.company}</p>

              <div className="flex flex-wrap gap-2 mb-5 text-xs">
                {job.location     && <span className="flex items-center gap-1" style={{ color: '#8A6A50' }}><MapPin size={11} />{job.location}</span>}
                {job.work_type    && <span className="flex items-center gap-1" style={{ color: '#8A6A50' }}><Briefcase size={11} />{job.work_type}</span>}
                {job.compensation && <span className="flex items-center gap-1" style={{ color: '#148A3C' }}><DollarSign size={11} />{job.compensation}</span>}
                {job.applied_at   && <span className="flex items-center gap-1" style={{ color: '#A52700' }}><Calendar size={11} />Applied {new Date(job.applied_at).toLocaleDateString()}</span>}
              </div>

              <div className="flex items-center gap-4 mb-1">
                <div className="tooltip-wrap">
                  <ScoreRing score={score} size={80} />
                  <span className="tooltip">AI calculated match score between your resume and this job description</span>
                </div>
                <div className="space-y-2">
                  <FitBadge level={job.fit_level} />
                  {job.posting_date && <p className="text-xs" style={{ color: '#8A6A50' }}>Posted {job.posting_date}</p>}
                </div>
              </div>
              <p className="text-[11px] mb-5 ml-0.5" style={{ color: '#8A6A50' }}>
                {score}% Resume Match Score
              </p>
            </div>

            {/* Status */}
            <div className="px-6 mb-5">
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#8A6A50' }}>
                Pipeline Status
              </label>
              <select value={status} onChange={e => handleStatusChange(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none cursor-pointer appearance-none"
                style={{ background: '#EDE8DE', border: '1px solid #E0D8CC', color: '#1A0800',
                  backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s} style={{ background: '#F5F0E8' }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="px-6 flex gap-2 mb-5">
              {job.job_url && (
                <button onClick={() => trigger(job.job_url)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors"
                  style={{ background: '#A52700', color: '#FAF7F0' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#8A2000'}
                  onMouseLeave={e => e.currentTarget.style.background = '#A52700'}>
                  Open Job <ExternalLink size={13} />
                </button>
              )}
              {(job.resume_url || job.resume_path) && (
                <button
                  onClick={() => downloadResume(job)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors"
                  style={{ background: '#F5F0E8', border: '1px solid #A52700', color: '#A52700' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EDE8DE'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F5F0E8'}>
                  Resume <Download size={13} />
                </button>
              )}
            </div>

            {/* Fit reason */}
            {job.reason && (
              <div className="mx-6 mb-5 rounded-xl p-3.5"
                style={{ background: 'rgba(165,39,0,0.06)', border: '1px solid rgba(165,39,0,0.15)' }}>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#8A6A50' }}>AI Fit Reason</p>
                <p className="text-sm leading-relaxed" style={{ color: '#4A2810' }}>{job.reason}</p>
              </div>
            )}

            {job.requirements_summary && (
              <div className="px-6 mb-5">
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#8A6A50' }}>Requirements</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#4A2810' }}>
                  {job.requirements_summary}
                </p>
              </div>
            )}

            {job.tech_tools && (
              <div className="px-6 pb-6">
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#8A6A50' }}>Tech &amp; Tools</p>
                <TechChips text={job.tech_tools} />
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="flex-1 flex flex-col min-h-0" style={{ background: '#FAF7F0' }}>
            <div className="px-6 pt-5 pb-0 shrink-0" style={{ borderBottom: '1px solid #E0D8CC' }}>
              <div className="flex gap-1">
                {TABS.map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px"
                    style={tab === t
                      ? { color: '#A52700', borderBottomColor: '#A52700', background: 'rgba(165,39,0,0.05)' }
                      : { color: '#8A6A50', borderBottomColor: 'transparent' }
                    }
                    onMouseEnter={e => { if (tab !== t) e.currentTarget.style.color = '#4A2810' }}
                    onMouseLeave={e => { if (tab !== t) e.currentTarget.style.color = '#8A6A50' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === 'Original Resume' && <ResumeDocument text={job.original_resume_text} />}
              {tab === 'Tailored Resume'  && <ResumeDocument text={job.tailored_resume_text} />}
              {tab === 'AI Compare'       && <AIComparePanel job={job} />}
            </div>
          </div>
        </div>
      </div>

      {pending && <ApplyPopup job={job} onYes={handleConfirmApply} onNo={dismiss} />}
    </>
  )
}
