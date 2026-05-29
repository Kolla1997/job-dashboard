const TODAY = new Date().toISOString().split('T')[0]

function ScoreRing({ score, size = 72 }) {
  const sw = 7, r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E0D8CC" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#A52700" strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dy="0.35em"
        fill="#A52700" fontSize={size * 0.21} fontWeight="700" fontFamily="system-ui">
        {score}%
      </text>
    </svg>
  )
}

function StatCard({ value, sub, label, valueColor = '#A52700', dot = false }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: '#F5F0E8', border: '1px solid #E0D8CC' }}>
      <div className="flex items-center gap-1.5">
        {dot && (
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
        )}
        <div className="text-2xl font-bold leading-none" style={{ color: valueColor }}>{value}</div>
      </div>
      <div className="text-xs mt-1" style={{ color: '#8A6A50' }}>{sub}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1.5" style={{ color: '#4A2810' }}>{label}</div>
    </div>
  )
}

export default function StatsBar({ jobs }) {
  const total        = jobs.length
  const addedToday   = jobs.filter(j => j.created_at && j.created_at.split('T')[0] === TODAY).length
  const applied      = jobs.filter(j => ['applied','screening','interview','offer','accepted'].includes(j.status)).length
  const readyToApply = jobs.filter(j => j.status === 'tailored').length
  const interviews   = jobs.filter(j => j.status === 'interview').length
  const avgScore     = total > 0
    ? Math.round(jobs.reduce((sum, j) => sum + (j.fit_score || 0), 0) / total)
    : 0

  return (
    <div className="space-y-2.5 px-1">
      <StatCard value={addedToday}   sub="scraped today"    label="Added Today"    valueColor="#A52700" dot />
      <StatCard value={total}        sub="in pipeline"      label="Total Jobs"     valueColor="#1A0800" />
      <StatCard value={applied}      sub="submitted"        label="Applied"        valueColor="#A52700" />
      <StatCard value={readyToApply} sub="tailored & ready" label="Ready to Apply" valueColor="#C86A00" />
      <StatCard value={interviews}   sub="active"           label="Interviews"     valueColor="#1E3CB4" />
      <div className="rounded-xl p-3.5 flex flex-col items-center"
        style={{ background: '#F5F0E8', border: '1px solid #E0D8CC' }}>
        <ScoreRing score={avgScore} size={72} />
        <div className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#4A2810' }}>Avg Fit Score</div>
      </div>
    </div>
  )
}
