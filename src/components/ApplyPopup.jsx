import { useState } from 'react'

const AVATAR_COLORS = ['#A52700','#8A2000','#C86A00','#4A2810','#7A3A10','#5A2008','#6A4828','#3A1A08','#B45A00']

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

export default function ApplyPopup({ job, onYes, onNo }) {
  const [applying, setApplying] = useState(false)
  const [applied,  setApplied]  = useState(false)
  const color = avatarColor(job.company)

  const handleYes = async () => {
    setApplying(true)
    try {
      await onYes()
      setApplied(true)
      setTimeout(() => onNo(), 1600)
    } catch (err) {
      console.error('Apply error:', err)
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(250,247,240,0.97)', backdropFilter: 'blur(4px)' }}
      onClick={() => !applying && !applied && onNo()}>
      <div className="rounded-2xl p-7 max-w-sm w-full mx-4"
        style={{
          background: '#FAF7F0',
          border: '1px solid #E0D8CC',
          boxShadow: '0 20px 60px rgba(165,39,0,0.15), 0 4px 16px rgba(26,8,0,0.08)',
        }}
        onClick={e => e.stopPropagation()}>

        {applied ? (
          <div className="flex flex-col items-center py-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(165,39,0,0.1)', border: '2px solid #A52700' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"
                stroke="#A52700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-semibold text-lg" style={{ color: '#A52700' }}>Application Logged!</p>
            <p className="text-sm mt-1" style={{ color: '#8A6A50' }}>Status updated to Applied</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                style={{ backgroundColor: color, color: '#FAF7F0' }}>
                {initials(job.company)}
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: '#1A0800' }}>{job.job_title}</p>
                <p className="text-xs" style={{ color: '#4A2810' }}>{job.company}</p>
              </div>
            </div>

            <p className="font-medium mb-1.5" style={{ color: '#1A0800' }}>Did you apply to this job?</p>
            <p className="text-xs mb-5" style={{ color: '#8A6A50' }}>
              The job opened in a new tab. Track your application here.
            </p>

            <div className="flex gap-3">
              <button onClick={handleYes} disabled={applying}
                className="flex-1 py-2.5 font-semibold rounded-xl text-sm transition-colors disabled:opacity-60"
                style={{ background: '#A52700', color: '#FAF7F0' }}
                onMouseEnter={e => { if (!applying) e.currentTarget.style.background = '#8A2000' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#A52700' }}>
                {applying ? 'Saving…' : 'Yes, I Applied!'}
              </button>
              <button onClick={onNo}
                className="flex-1 py-2.5 font-medium rounded-xl text-sm transition-colors"
                style={{ background: '#F5F0E8', border: '1px solid #E0D8CC', color: '#4A2810' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#A52700'; e.currentTarget.style.color = '#A52700' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E0D8CC'; e.currentTarget.style.color = '#4A2810' }}>
                Not Yet
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
