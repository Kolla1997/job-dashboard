// ─────────────────────────────────────────────────────────────────────────────
// ResumeDocument — parses two resume text formats and renders a PDF-style doc.
//
// FORMAT A (tailored — tailor.py → format_resume_as_text):
//   Section headers: ALL CAPS  ("PROFESSIONAL SUMMARY", "TECHNOLOGIES", …)
//   Technologies:    "Category: skill1, skill2"          colon separator
//   Experience:      "Title | Company | Date | Loc" / "- bullet"
//   Education:       "University | Date" / "Degree"
//
// FORMAT B (original — raw PyPDF2):
//   Section headers: Mixed case ("Professional Summary", "Technologies", …)
//   Contact line:    "City|email|phone|linkedin"           no spaces around |
//   Technologies:    "CategoryNameskill1, skill2, …"      no colon/space separator
//   Experience:      title line / company+date line / "• bullet"
//   Education:       separate lines: university / date / degree
// ─────────────────────────────────────────────────────────────────────────────

// ── Section detection ────────────────────────────────────────────────────────

const SECTION_MAP = {
  'PROFESSIONAL SUMMARY': 'summary',
  'Professional Summary':  'summary',
  'TECHNOLOGIES':          'tech',
  'Technologies':          'tech',
  'EXPERIENCE':            'exp',
  'Experience':            'exp',
  'EDUCATION':             'edu',
  'Education':             'edu',
}

const KNOWN_CATS = [
  'Product Strategy & Delivery',
  'Analytics & Reporting',
  'Process Optimization',
  'Tools & Platforms',
  'Collaboration & Leadership',
]

const DATE_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|\d{4})\b/i

// ── Core extractor ───────────────────────────────────────────────────────────

function extractSections(text) {
  const lines = text.split('\n')
  const bounds = []
  lines.forEach((line, i) => {
    const t = line.trim()
    if (SECTION_MAP[t] !== undefined) bounds.push({ key: SECTION_MAP[t], idx: i })
  })
  if (bounds.length < 2) return null

  const headerLines = lines.slice(0, bounds[0].idx).filter(l => l.trim())
  const sections = {}
  bounds.forEach((b, i) => {
    const end = bounds[i + 1]?.idx ?? lines.length
    sections[b.key] = lines.slice(b.idx + 1, end).join('\n').trim()
  })
  return { headerLines, sections }
}

// ── Technology parsers ───────────────────────────────────────────────────────

function parseTechColon(text) {
  return text.split('\n')
    .filter(l => l.includes(':'))
    .map(l => {
      const ci = l.indexOf(':')
      return {
        category: l.slice(0, ci).trim(),
        skills:   l.slice(ci + 1).split(',').map(s => s.trim()).filter(Boolean),
      }
    })
    .filter(t => t.category && t.skills.length)
}

function parseTechCats(text) {
  const flat = text.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (!flat) return []
  const positions = KNOWN_CATS
    .map(cat => ({ cat, idx: flat.indexOf(cat) }))
    .filter(p => p.idx !== -1)
    .sort((a, b) => a.idx - b.idx)
  if (!positions.length) return []
  return positions.map(({ cat, idx }, i) => {
    const start = idx + cat.length
    const end   = positions[i + 1]?.idx ?? flat.length
    const skills = flat.slice(start, end).split(',').map(s => s.trim()).filter(Boolean)
    return { category: cat, skills }
  }).filter(t => t.skills.length)
}

function parseTech(text) {
  const colon = parseTechColon(text)
  return colon.length >= 2 ? colon : parseTechCats(text)
}

// ── Experience parsers ───────────────────────────────────────────────────────

// Format B (original PDF) — title-anchored extraction using known job titles
const JOB_TITLES = [
  'Offboarding Project Manager',
  'Human Resources Information System Analyst',
  'Strategy and Process Analyst',
  'Learning and Development Manager',
  'Project Manager – Recruitment',
  'Project Manager',
]

function parseOriginalExperience(text) {
  const positions = []
  for (const title of JOB_TITLES) {
    const idx = text.indexOf(title)
    if (idx !== -1) positions.push({ title, idx })
  }
  positions.sort((a, b) => a.idx - b.idx)
  if (!positions.length) return []

  return positions.map(({ title, idx }, i) => {
    const end   = positions[i + 1]?.idx ?? text.length
    const block = text.slice(idx, end).trim()
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

    let company = '', date = '', location = ''
    const bullets = []

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j]

      if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/.test(line)) {
        date = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^\n]*/)?.[0] || ''
        const beforeDate = line.split(/\b(Jan|Feb|Mar|Apr|May|Jun)/)[0].trim()
        if (beforeDate) company = beforeDate
      } else if (/\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line)) {
        location = line
      } else if (/^[•\-·]/.test(line)) {
        bullets.push(line.replace(/^[•\-·]\s*/, '').trim())
      } else if (line.length < 60 && !company && j < 4) {
        company = line
      } else if (line.length > 20 && j > 2) {
        bullets.push(line)
      }
    }

    return { title, company, date, location, bullets }
  })
}

function parseExpPipe(text) {
  const jobs = []
  let cur = null
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) { if (cur) { jobs.push(cur); cur = null } continue }
    if (/^[-•●]\s/.test(t)) { if (cur) cur.bullets.push(t.replace(/^[-•●]\s*/, '')); continue }
    if (t.includes(' | ')) {
      if (cur) jobs.push(cur)
      const [title='', company='', date='', location=''] = t.split(' | ').map(p => p.trim())
      cur = { title, company, date, location, bullets: [] }
      continue
    }
    if (cur?.bullets.length) cur.bullets[cur.bullets.length - 1] += ' ' + t
  }
  if (cur) jobs.push(cur)
  return jobs
}

function parseExpBlocks(text) {
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim())
  return blocks.flatMap(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const jobs = []
    let cur = null
    for (const t of lines) {
      const isBullet = /^[•\-●\*]\s/.test(t)
      if (isBullet) {
        if (!cur) cur = { title: '', company: '', date: '', location: '', bullets: [] }
        cur.bullets.push(t.replace(/^[•\-●\*]\s*/, ''))
        continue
      }
      if (cur?.bullets.length) { jobs.push(cur); cur = null }
      if (!cur) { cur = { title: t, company: '', date: '', location: '', bullets: [] }; continue }
      if (!cur.company) {
        if (t.includes(' | ')) {
          const parts = t.split(' | ').map(p => p.trim())
          cur.company = parts[0]; cur.date = parts[1] || ''; cur.location = parts[2] || ''
        } else if (DATE_RE.test(t) && !cur.title.match(DATE_RE)) {
          cur.date = t
        } else {
          cur.company = t
        }
      } else if (!cur.date && DATE_RE.test(t)) {
        cur.date = t
      } else if (!cur.location) {
        cur.location = t
      }
    }
    if (cur) jobs.push(cur)
    return jobs
  }).filter(j => j.title || j.bullets.length)
}

function parseExp(text) {
  // Format A: pipe-separated header ("Title | Company | Date | Loc")
  const pipe = parseExpPipe(text)
  if (pipe.some(j => j.bullets.length)) return pipe

  // Format B: try known title anchors first (original PDF)
  const original = parseOriginalExperience(text)
  if (original.length) return original

  // Last resort: generic block heuristic
  return parseExpBlocks(text)
}

// ── Education parser ─────────────────────────────────────────────────────────

function parseEdu(text) {
  return text.split(/\n\s*\n/).filter(b => b.trim()).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return null
    if (lines[0].includes(' | ')) {
      const parts = lines[0].split(/\s*\|\s*/)
      return { university: parts[0] || '', date: parts[parts.length - 1] || '', degree: lines[1] || '' }
    }
    const dateIdx = lines.findIndex(l => DATE_RE.test(l))
    if (dateIdx === -1) return { university: lines[0], date: '', degree: lines[1] || '' }
    const degree = lines.find((l, i) => i !== 0 && i !== dateIdx) || ''
    return { university: lines[0], date: lines[dateIdx], degree }
  }).filter(Boolean).filter(e => e.university)
}

// ── Top-level parse ──────────────────────────────────────────────────────────

function parseResume(text) {
  if (!text?.trim()) return null
  const extracted = extractSections(text)
  if (!extracted) return null
  const { headerLines, sections } = extracted

  let name    = 'Hasitha Sigatapu'
  let contact = 'Chicago, IL | hasithasigatapu03@gmail.com | 779-261-7696 | linkedin.com/in/hasitha-sharon/'
  if (headerLines.length >= 1) name    = headerLines[0]
  if (headerLines.length >= 2) contact = headerLines[1]

  return {
    name,
    contactParts: contact.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean),
    summary:      sections.summary || '',
    technologies: parseTech(sections.tech || ''),
    experience:   parseExp(sections.exp   || ''),
    education:    parseEdu(sections.edu   || ''),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual components — PDF document style
// ─────────────────────────────────────────────────────────────────────────────

const FONT  = "'Georgia', 'Times New Roman', serif"
const C_HEAD = '#1A0800'
const C_ACC  = '#A52700'
const C_BODY = '#4A2810'
const C_MUT  = '#8A6A50'
const C_BDR  = '#E0D8CC'

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: FONT,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: C_ACC,
      borderBottom: `1px solid ${C_BDR}`,
      paddingBottom: 5,
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Chip({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      background: 'rgba(165,39,0,0.08)',
      color: C_ACC,
      border: '1px solid rgba(165,39,0,0.2)',
      borderRadius: 20,
      fontSize: 11,
      padding: '2px 8px',
      margin: '2px',
      fontFamily: 'system-ui, sans-serif',
      lineHeight: 1.5,
    }}>
      {children}
    </span>
  )
}

// Fallback for unrecognised text — clean readable block, no monospace
function FallbackView({ text }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 8,
      padding: 32,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: `1px solid ${C_BDR}`,
    }}>
      {text
        ? <p style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.8, color: C_BODY, margin: 0, whiteSpace: 'pre-wrap' }}>
            {text}
          </p>
        : <p style={{ fontFamily: FONT, fontStyle: 'italic', color: C_MUT, textAlign: 'center', margin: 0 }}>
            No resume text available in database.
          </p>
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function ResumeDocument({ text }) {
  const doc = parseResume(text)
  if (!doc) return <FallbackView text={text} />

  const { name, contactParts, summary, technologies, experience, education } = doc
  const hasLeft  = technologies.length > 0 || education.length > 0
  const hasRight = !!summary || experience.length > 0

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
      overflow: 'hidden',
      fontFamily: FONT,
    }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '32px 40px 20px', textAlign: 'center', background: '#FFFFFF' }}>
        <h1 style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 700,
          color: C_HEAD,
          margin: '0 0 8px 0',
          letterSpacing: '-0.01em',
        }}>
          {name}
        </h1>
        <div style={{ fontSize: 13, color: C_BODY, letterSpacing: '0.01em' }}>
          {contactParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span style={{ margin: '0 10px', color: C_ACC, fontWeight: 700 }}>•</span>}
              {part}
            </span>
          ))}
        </div>
        {/* Red rule */}
        <div style={{ height: 2, background: C_ACC, borderRadius: 1, marginTop: 18 }} />
      </div>

      {/* ── BODY ── */}
      {(!hasLeft && !hasRight)
        ? <div style={{ padding: 40 }}><FallbackView text={text} /></div>
        : (
          <div style={{ display: 'flex', minHeight: 0 }}>

            {/* ── LEFT 30% ── */}
            {hasLeft && (
              <div style={{
                width: '30%',
                flexShrink: 0,
                background: '#F9F5F0',
                borderRight: `1px solid ${C_BDR}`,
                padding: 20,
              }}>

                {/* Technologies */}
                {technologies.length > 0 && (
                  <div style={{ marginBottom: education.length > 0 ? 24 : 0 }}>
                    <SectionLabel>Technologies</SectionLabel>
                    {technologies.map((tech, i) => (
                      <div key={i} style={{ marginTop: i === 0 ? 0 : 12 }}>
                        <div style={{
                          fontFamily: FONT,
                          fontSize: 12,
                          fontWeight: 700,
                          color: C_HEAD,
                          marginBottom: 4,
                        }}>
                          {tech.category}
                        </div>
                        <div>
                          {tech.skills.map((s, j) => <Chip key={j}>{s}</Chip>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Education */}
                {education.length > 0 && (
                  <div>
                    <SectionLabel>Education</SectionLabel>
                    {education.map((edu, i) => (
                      <div key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C_HEAD, lineHeight: 1.4 }}>
                          {edu.university}
                        </div>
                        {edu.date && (
                          <div style={{ fontSize: 11, color: C_ACC, marginTop: 2 }}>{edu.date}</div>
                        )}
                        {edu.degree && (
                          <div style={{ fontSize: 11, fontStyle: 'italic', color: C_BODY, marginTop: 2 }}>
                            {edu.degree}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── RIGHT 70% ── */}
            {hasRight && (
              <div style={{ flex: 1, minWidth: 0, padding: '20px 24px' }}>

                {/* Professional Summary */}
                {summary && (
                  <div style={{ marginBottom: experience.length > 0 ? 22 : 0 }}>
                    <SectionLabel>Professional Summary</SectionLabel>
                    <p style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      lineHeight: 1.8,
                      color: C_HEAD,
                      textAlign: 'justify',
                      margin: 0,
                    }}>
                      {summary}
                    </p>
                  </div>
                )}

                {/* Experience */}
                {experience.length > 0 && (
                  <div>
                    <SectionLabel>Experience</SectionLabel>
                    {experience.map((job, i) => (
                      <div key={i} style={{
                        marginTop: i === 0 ? 0 : 16,
                        paddingTop: i === 0 ? 0 : 16,
                        borderTop: i === 0 ? 'none' : `1px solid ${C_BDR}`,
                      }}>
                        {/* Title */}
                        {job.title && (
                          <div style={{ fontSize: 14, fontWeight: 700, color: C_HEAD, marginBottom: 3, lineHeight: 1.3 }}>
                            {job.title}
                          </div>
                        )}

                        {/* Company • Date • Location */}
                        {(job.company || job.date || job.location) && (
                          <div style={{ fontSize: 12, color: C_ACC, marginBottom: 8, lineHeight: 1.4 }}>
                            {[job.company, job.date, job.location].filter(Boolean).join('  •  ')}
                          </div>
                        )}

                        {/* Bullets */}
                        {job.bullets.length > 0 && (
                          <div style={{ paddingLeft: 16 }}>
                            {job.bullets.map((bullet, j) => (
                              <div key={j} style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-start',
                                marginBottom: j < job.bullets.length - 1 ? 5 : 0,
                              }}>
                                <span style={{
                                  color: C_ACC,
                                  fontSize: 10,
                                  flexShrink: 0,
                                  marginTop: 4,
                                  lineHeight: 1,
                                }}>▪</span>
                                <span style={{
                                  fontFamily: FONT,
                                  fontSize: 12,
                                  color: C_BODY,
                                  lineHeight: 1.6,
                                }}>
                                  {bullet}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}
