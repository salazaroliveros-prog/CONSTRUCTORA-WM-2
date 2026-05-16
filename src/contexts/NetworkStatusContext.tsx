import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { processPendingQueue, getDocumentsForCollection } from '../services/firestoreService'
import { getQueueLength } from '../services/offlineQueue'
import { REQUIRED_COLLECTIONS } from '../services/firestoreService'

interface SyncStatus {
  pending: number
  lastSync: string | null
  syncing: boolean
}

interface NetworkStatusContextValue {
  isOnline: boolean
  syncStatus: SyncStatus
  triggerSync: () => Promise<void>
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({
  isOnline: true,
  syncStatus: { pending: 0, lastSync: null, syncing: false },
  triggerSync: async () => {},
})

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pending: getQueueLength(),
    lastSync: localStorage.getItem('app_last_sync'),
    syncing: false,
  })

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return
    setSyncStatus(prev => ({ ...prev, syncing: true }))
    try {
      const result = await processPendingQueue()
      const now = new Date().toISOString()
      localStorage.setItem('app_last_sync', now)
      setSyncStatus({
        pending: getQueueLength(),
        lastSync: now,
        syncing: false,
      })
      if (result.processed > 0) {
        console.info(`[sync] Processed ${result.processed} pending operations${result.failed > 0 ? `, ${result.failed} failed` : ''}`)
        for (const name of REQUIRED_COLLECTIONS) {
          try { await getDocumentsForCollection(name) } catch { /* cache refresh best-effort */ }
        }
      }
    } catch (e) {
      console.error('[sync] Sync failed:', e)
      setSyncStatus(prev => ({ ...prev, syncing: false, pending: getQueueLength() }))
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      triggerSync()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const heartbeat = setInterval(async () => {
      try {
        await fetch('https://firestore.googleapis.com/v1/projects/coonstructora-wm-mys/databases/(default)/documents', {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        })
        if (!navigator.onLine) return
        if (!isOnline) {
          setIsOnline(true)
          triggerSync()
        }
      } catch {
        if (navigator.onLine) return
        if (isOnline) setIsOnline(false)
      }
    }, 30000)

    const pendingCheck = setInterval(() => {
      const pending = getQueueLength()
      setSyncStatus(prev => prev.pending !== pending ? { ...prev, pending } : prev)
    }, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(heartbeat)
      clearInterval(pendingCheck)
    }
  }, [isOnline, triggerSync])

  return (
    <NetworkStatusContext.Provider value={{ isOnline, syncStatus, triggerSync }}>
      {children}
    </NetworkStatusContext.Provider>
  )
}

export function useNetworkStatus() {
  return useContext(NetworkStatusContext)
}

