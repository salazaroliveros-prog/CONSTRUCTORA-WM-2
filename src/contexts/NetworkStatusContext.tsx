import React, { createContext, useContext, useEffect, useState } from 'react'

interface NetworkStatusContextValue {
  isOnline: boolean
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({ isOnline: true })

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <NetworkStatusContext.Provider value={{ isOnline }}>
      {children}
    </NetworkStatusContext.Provider>
  )
}

export function useNetworkStatus() {
  return useContext(NetworkStatusContext)
}
