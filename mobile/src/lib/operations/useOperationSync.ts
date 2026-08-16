import { useIsRestoring, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { setOperationQueryClient, startOperationSync } from './queue'

/**
 * Runs the durable operation queue for the app's lifetime: hands the queue the
 * React Query client so settled commands invalidate reads, and starts the
 * replay loop (reconnect + foreground + interval). Mounted once at the root.
 */
export function useOperationSync(): void {
  const queryClient = useQueryClient()
  const isRestoring = useIsRestoring()

  useEffect(() => {
    if (isRestoring) return
    let disposed = false
    let stop: () => void = () => undefined
    void setOperationQueryClient(queryClient).then(() => {
      if (!disposed) stop = startOperationSync()
    })
    return () => {
      disposed = true
      stop()
      void setOperationQueryClient(null)
    }
  }, [isRestoring, queryClient])
}
