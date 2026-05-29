export async function downloadResume(job) {
  const url = job.resume_path || job.resume_url
  if (!url) return

  const company = (job.company || 'Company')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30)

  const title = (job.job_title || 'Resume')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30)

  const filename = `Hasitha_Sigatapu_${company}_${title}.docx`

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}
