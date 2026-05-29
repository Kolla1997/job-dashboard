import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kkwyfwojuzzjcjxgctiw.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_ntSybiK4nHEkrag4u8H59w_l2h_9b-V'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('fit_score', { ascending: false })
  if (error) throw error
  return data
}

export async function markApplied(jobId) {
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('job_id', jobId)
  if (error) throw error
}

export async function updateJobStatus(jobId, status) {
  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('job_id', jobId)
  if (error) throw error
}
