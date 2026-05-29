import { useState } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateJobStatus } from '../lib/supabase'

const COLUMNS = [
  { id: 'new',       label: 'New',       accent: '#8A6A50' },
  { id: 'scored',    label: 'Scored',    accent: '#8A6A50' },
  { id: 'tailored',  label: 'Tailored',  accent: '#A52700' },
  { id: 'applied',   label: 'Applied',   accent: '#A52700' },
  { id: 'screening', label: 'Screening', accent: '#C86A00' },
  { id: 'interview', label: 'Interview', accent: '#1E3CB4' },
  { id: 'offer',     label: 'Offer',     accent: '#148A3C' },
  { id: 'accepted',  label: 'Accepted',  accent: '#0D6B2A' },
  { id: 'rejected',  label: 'Rejected',  accent: '#B41E1E' },
]

function daysSince(dateStr) {
  if (!dateStr) return null
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? '1d ago' : `${d}d ago`
}

function scoreBadgeStyle(score) {
  if (score >= 80) return { background: '#A52700', color: '#FAF7F0' }
  if (score >= 70) return { background: '#C86A00', color: '#FAF7F0' }
  if (score >= 60) return { background: '#E8A020', color: '#1A0800' }
  return               { background: '#EDE8DE',  color: '#4A2810' }
}

function KanbanCard({ job, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: job.job_id })
  const score = job.fit_score || 0
  const ss    = scoreBadgeStyle(score)
  const ds    = daysSince(job.applied_at || job.created_at)

  const cardStyle = {
    transform:    CSS.Transform.toString(transform),
    transition,
    opacity:      isDragging ? 0.35 : 1,
    background:   '#F5F0E8',
    border:       '1px solid #E0D8CC',
    borderRadius: '8px',
    padding:      '12px',
    cursor:       'grab',
    userSelect:   'none',
  }

  return (
    <div ref={setNodeRef} style={cardStyle} {...attributes} {...listeners}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8B8A8'; e.currentTarget.style.background = '#EDE8DE' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E0D8CC'; e.currentTarget.style.background = '#F5F0E8' }}>
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[11px] truncate" style={{ color: '#8A6A50' }}>{job.company}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={ss}>{score}%</span>
      </div>
      <p style={{
        color: '#1A0800', fontSize: '12px', fontWeight: 500, lineHeight: '1.35',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        marginBottom: ds ? '8px' : 0,
      }}>
        {job.job_title}
      </p>
      {ds && <p className="text-[10px]" style={{ color: '#C8B8A8' }}>{ds}</p>}
    </div>
  )
}

function Column({ column, jobs, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col shrink-0 w-52">
      <div className="mb-2 rounded-t-lg px-3 py-2.5"
        style={{ borderTop: `2px solid ${column.accent}`, background: `${column.accent}14` }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: '#1A0800' }}>{column.label}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${column.accent}20`, color: column.accent }}>
            {jobs.length}
          </span>
        </div>
      </div>

      <SortableContext items={jobs.map(j => j.job_id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[100px] rounded-b-lg p-1.5 transition-colors"
          style={isOver ? { background: `${column.accent}0C`, outline: `1px solid ${column.accent}40` } : {}}>
          {jobs.map(job => (
            <KanbanCard key={job.job_id} job={job} isDragging={job.job_id === activeId} />
          ))}
          {jobs.length === 0 && (
            <div className="flex items-center justify-center h-16 rounded-lg"
              style={{ border: '1px dashed #E0D8CC' }}>
              <p className="text-[10px]" style={{ color: '#C8B8A8' }}>Drop here</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function DragPreview({ job }) {
  if (!job) return null
  const ss = scoreBadgeStyle(job.fit_score || 0)
  return (
    <div className="rounded-lg w-48"
      style={{ background: '#F5F0E8', border: '1px solid #A52700', padding: '12px',
        transform: 'rotate(2deg)', cursor: 'grabbing',
        boxShadow: '0 8px 24px rgba(165,39,0,0.15)' }}>
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[11px] truncate" style={{ color: '#8A6A50' }}>{job.company}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={ss}>{job.fit_score || 0}%</span>
      </div>
      <p className="text-xs font-medium" style={{ color: '#1A0800' }}>{job.job_title}</p>
    </div>
  )
}

export default function Kanban({ jobs, setJobs }) {
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const byCol = COLUMNS.reduce((acc, col) => {
    acc[col.id] = jobs.filter(j => (j.status || 'new') === col.id)
    return acc
  }, {})

  const findCol = (jobId) => {
    for (const col of COLUMNS) if (byCol[col.id]?.some(j => j.job_id === jobId)) return col.id
    return null
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const jobId = active.id
    let colId = over.id
    if (!COLUMNS.find(c => c.id === colId)) colId = findCol(colId)
    if (!colId) return
    const prev = findCol(jobId)
    if (prev === colId) return
    setJobs(js => js.map(j => j.job_id === jobId ? { ...j, status: colId } : j))
    try { await updateJobStatus(jobId, colId) }
    catch { setJobs(js => js.map(j => j.job_id === jobId ? { ...j, status: prev } : j)) }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {COLUMNS.map(col => (
            <Column key={col.id} column={col} jobs={byCol[col.id] || []} activeId={activeId} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        <DragPreview job={activeId ? jobs.find(j => j.job_id === activeId) : null} />
      </DragOverlay>
    </DndContext>
  )
}
