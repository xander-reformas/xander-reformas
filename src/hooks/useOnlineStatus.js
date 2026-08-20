import { useEffect, useState } from 'react'

/** Estado de conexión del navegador (online/offline), con listeners en vivo. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const setOnlineTrue = () => setOnline(true)
    const setOnlineFalse = () => setOnline(false)
    window.addEventListener('online', setOnlineTrue)
    window.addEventListener('offline', setOnlineFalse)
    return () => {
      window.removeEventListener('online', setOnlineTrue)
      window.removeEventListener('offline', setOnlineFalse)
    }
  }, [])

  return online
}
