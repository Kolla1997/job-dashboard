import { Download, MapPin, Briefcase, ExternalLink } from 'lucide-react'
import { markApplied } from '../lib/supabase'
import { useApplyFlow } from '../hooks/useApplyFlow'
import { downloadResume } from '../lib/downloadResume'
import ApplyPopup from './ApplyPopup'

const AVATAR_COLORS = ['#A52700','#8A2000','#C86A00','#4A2810','#7A3A10','#5A2008','#6A4828','#3A1A08','#B45A00']

const STATUS_PILLS = {
  new:       { bg: 'rgba(74,40,16,0.08)',    text: '#8A6A50' },
  scored:    { bg: 'rgba(74,40,16,0.1)',     text: '#4A2810' },
  tailored:  { bg: 'rgba(165,39,0,0.1)',     text: '#A52700' },
  applied:   { bg: 'rgba(165,39,0,0.2)',     text: '#8A2000' },
  screening: { bg: 'rgba(200,106,0,0.15)',   text: '#A55000' },
  interview: { bg: 'rgba(30,60,180,0.1)',    text: '#1E3CB4' },
  offer:     { bg: 'rgba(20,120,60,0.1)',    text: '#148A3C' },
  accepted:  { bg: 'rgba(20,120,60,0.2)',    text: '#0D6B2A' },
  rejected:  { bg: 'rgba(180,30,30,0.1)',    text: '#B41E1E' },
  withdrawn: { bg: 'rgba(100,100,100,0.1)',  text: '#606060' },
}

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

function accentStyle(score) {
  if (score >= 80) return { borderColor: '#A52700', glow: 'card-glow-green' }
  if (score >= 70) return { borderColor: '#C86A00', glow: 'card-glow-yellow' }
  if (score >= 60) return { borderColor: '#E8A020', glow: 'card-glow-muted' }
  return               { borderColor: '#E0D8CC',  glow: 'card-glow' }
}

function scoreBadgeStyle(score) {
  if (score >= 80) return { background: '#A52700', color: '#FAF7F0', borderColor: '#8A2000' }
  if (score >= 70) return { background: '#C86A00', color: '#FAF7F0', borderColor: '#A55000' }
  if (score >= 60) return { background: '#E8A020', color: '#1A0800', borderColor: '#C88010' }
  return               { background: '#EDE8DE', color: '#4A2810',  borderColor: '#E0D8CC' }
}

function ScoreBadge({ score }) {
  const s = scoreBadgeStyle(score)
  return (
    <div className="tooltip-wrap shrink-0">
      <span className="text-xs font-bold px-2 py-0.5 rounded-full border cursor-default whitespace-nowrap"
        style={{ background: s.background, color: s.color, borderColor: s.borderColor }}>
        {score}% Match
      </span>
      <span className="tooltip">AI calculated match score between your resume and this job description</span>
    </div>
  )
}

export default function JobCard({ job, onUpdate, onOpenDetail }) {
  const { pending, trigger, dismiss } = useApplyFlow()

  const score       = job.fit_score || 0
  const accent      = accentStyle(score)
  const statusLabel = job.status || 'new'
  const pill        = STATUS_PILLS[statusLabel] || STATUS_PILLS.new

  const handleConfirmApply = async () => {
    await markApplied(job.job_id)
    onUpdate(job.job_id, { status: 'applied', applied_at: new Date().toISOString() })
  }

  return (
    <>
      <div
        className={`rounded-xl p-4 cursor-pointer transition-all duration-200 flex flex-col gap-3 ${accent.glow}`}
        style={{ background: '#F5F0E8', border: `1px solid #E0D8CC`, borderLeft: `4px solid ${accent.borderColor}` }}
        onMouseEnter={e => e.currentTarget.style.background = '#EDE8DE'}
        onMouseLeave={e => e.currentTarget.style.background = '#F5F0E8'}
        onClick={() => onOpenDetail(job)}
      >
        {/* Row 1: Avatar + company + score */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none"
            style={{ backgroundColor: avatarColor(job.company), color: '#FAF7F0' }}>
            {initials(job.company)}
          </div>
          <p className="flex-1 text-xs truncate leading-tight" style={{ color: '#4A2810' }}>{job.company}</p>
          <ScoreBadge score={score} />
        </div>

        {/* Row 2: Title */}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: '#1A0800' }}>
          {job.job_title}
        </h3>

        {/* Row 3: Location + work type */}
        <div className="flex items-center gap-3 text-xs" style={{ color: '#8A6A50' }}>
          {job.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin size={11} className="shrink-0" /> {job.location}
            </span>
          )}
          {job.work_type && (
            <span className="flex items-center gap-1 shrink-0">
              <Briefcase size={11} className="shrink-0" /> {job.work_type}
            </span>
          )}
        </div>

        {/* Row 4: AI reason */}
        {job.reason && (
          <p className="text-xs italic line-clamp-2 leading-relaxed" style={{ color: '#8A6A50' }}>
            {job.reason}
          </p>
        )}

        {/* Row 5: Status + actions */}
        <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #E0D8CC' }}>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: pill.bg, color: pill.text }}>
            {statusLabel}
          </span>
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {(job.resume_url || job.resume_path) && (
              <button
                onClick={e => { e.stopPropagation(); downloadResume(job) }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: '#F5F0E8', border: '1px solid #A52700', color: '#A52700' }}
                onMouseEnter={e => e.currentTarget.style.background = '#EDE8DE'}
                onMouseLeave={e => e.currentTarget.style.background = '#F5F0E8'}
                title="Download Resume">
                <Download size={13} />
              </button>
            )}
            {!['applied','accepted'].includes(job.status) && job.job_url && (
              <button
                onClick={e => { e.stopPropagation(); trigger(job.job_url) }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                style={{ background: '#A52700', color: '#FAF7F0' }}
                onMouseEnter={e => e.currentTarget.style.background = '#8A2000'}
                onMouseLeave={e => e.currentTarget.style.background = '#A52700'}>
                Apply <ExternalLink size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {pending && <ApplyPopup job={job} onYes={handleConfirmApply} onNo={dismiss} />}
    </>
  )
}
