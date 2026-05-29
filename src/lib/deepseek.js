const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_KEY || ''
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

/**
 * Returns a parsed JSON object:
 * {
 *   summary: string,
 *   match_score: number,
 *   changes: [{ section, type, original, tailored, reason }],
 *   key_improvements: string[],
 *   remaining_gaps: string[]
 * }
 */
export async function compareResumeToJD({ jobTitle, company, jd, originalResumeText, tailoredResumeText }) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured. Set VITE_DEEPSEEK_KEY in .env')
  }

  // Trim inputs to avoid hitting context/output limits
  const trimmedOriginal = originalResumeText?.slice(0, 2000) || '(not available)'
  const trimmedTailored = tailoredResumeText?.slice(0, 2000)  || '(not available)'

  const prompt = `You are a resume comparison expert.
Compare the ORIGINAL resume vs TAILORED resume for this job.

JOB: ${jobTitle} at ${company}

JOB REQUIREMENTS:
${jd || '(not provided)'}

ORIGINAL RESUME:
${trimmedOriginal}

TAILORED RESUME:
${trimmedTailored}

Return ONLY a valid JSON object, absolutely no markdown, no tables, no explanation outside the JSON.

{
  "summary": "One sentence: X changes made to better match this role",
  "match_score": 78,
  "changes": [
    {
      "section": "Summary",
      "type": "modified",
      "original": "what it said before",
      "tailored": "what it says now",
      "reason": "why this helps match the job"
    }
  ],
  "key_improvements": ["improvement 1", "improvement 2"],
  "remaining_gaps": ["gap 1", "gap 2"]
}`

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw  = data.choices[0].message.content

  // Strip any accidental markdown fences
  const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    console.error('DeepSeek raw response:', raw)

    // Try to salvage a JSON object from anywhere in the response
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        // fall through to fallback
      }
    }

    // Last-resort fallback — surface the raw text as a key improvement
    return {
      summary: 'Comparison completed — see details below',
      match_score: 0,
      changes: [],
      key_improvements: [raw.slice(0, 500)],
      remaining_gaps: [],
    }
  }
}
