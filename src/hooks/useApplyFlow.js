import { useState, useRef, useEffect } from 'react'

export function useApplyFlow() {
  const [pending, setPending] = useState(false)
  const timerRef = useRef(null)

  const trigger = (url) => {
    if (url) window.open(url, '_blank')
    timerRef.current = setTimeout(() => setPending(true), 2000)
  }

  const dismiss = () => {
    clearTimeout(timerRef.current)
    setPending(false)
  }

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { pending, trigger, dismiss }
}
