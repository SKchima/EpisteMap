import { useEffect, useState, useRef, useCallback } from 'react'
import { useGraphStore } from './graphStore'
import type { Graph, KnowledgeNode, KnowledgeEdge } from './types'

export type VaultSyncStatus = {
  isConnected: boolean
  isSyncing: boolean
  vaultPath: string | null
  lastSyncTime: Date | null
  forceSave: () => Promise<void>
  forceReload: () => Promise<void>
}

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}${path}`
  }
  return path
}

export function useVaultSync(): VaultSyncStatus {
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const loadGraph = useGraphStore((s) => s.loadGraph)

  const isIncomingUpdateRef = useRef<boolean>(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Salva o grafo atual no vault em disco
  const saveGraph = useCallback(
    async (currentNodes: KnowledgeNode[], currentEdges: KnowledgeEdge[]) => {
      if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
        return
      }
      setIsSyncing(true)
      try {
        const payload = {
          graph: {
            nodes: currentNodes,
            edges: currentEdges,
          },
        }
        const res = await fetch(getApiUrl('/api/vault'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setLastSyncTime(new Date())
        }
      } catch (err) {
        console.warn('[Vault Sync] Falha ao salvar no vault:', err)
      } finally {
        setIsSyncing(false)
      }
    },
    []
  )

  const forceSave = useCallback(async () => {
    await saveGraph(nodes, edges)
  }, [saveGraph, nodes, edges])

  // Força recarga manual do arquivo em disco
  const forceReload = useCallback(async () => {
    if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
      return
    }
    setIsSyncing(true)
    try {
      const res = await fetch(getApiUrl('/api/vault'))
      if (res.ok) {
        const data = await res.json()
        if (data.exists && data.graph) {
          isIncomingUpdateRef.current = true
          loadGraph(data.graph as Graph)
          setLastSyncTime(new Date())
          if (data.path) setVaultPath(data.path)
        }
      }
    } catch (err) {
      console.warn('[Vault Sync] Falha ao recarregar vault:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [loadGraph])

  // Inicialização e conexão com o canal SSE
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
      return
    }
    let eventSource: EventSource | null = null

    async function initVault() {
      try {
        const res = await fetch(getApiUrl('/api/vault'))
        if (res.ok) {
          const data = await res.json()
          if (data.path) setVaultPath(data.path)
          if (data.exists && data.graph && Array.isArray(data.graph.nodes)) {
            // Se o arquivo do vault já possui conteúdo em disco, carrega como fonte da verdade
            if (data.graph.nodes.length > 0) {
              isIncomingUpdateRef.current = true
              loadGraph(data.graph as Graph)
              setLastSyncTime(new Date())
            }
          }
        }
      } catch {
        // Modo offline ou sem servidor de vault ativo
      }

      try {
        eventSource = new EventSource(getApiUrl('/api/vault/events'))
        eventSource.onopen = () => {
          setIsConnected(true)
        }
        eventSource.onerror = () => {
          setIsConnected(false)
        }
        eventSource.addEventListener('vault-update', (event) => {
          try {
            const incomingGraph = JSON.parse(event.data) as Graph
            if (incomingGraph && Array.isArray(incomingGraph.nodes)) {
              isIncomingUpdateRef.current = true
              loadGraph(incomingGraph)
              setLastSyncTime(new Date())
            }
          } catch (parseErr) {
            console.warn('[Vault Sync] Erro ao processar atualização SSE:', parseErr)
          }
        })
      } catch {
        setIsConnected(false)
      }
    }

    void initVault()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [loadGraph])

  // Salva alterações da interface de volta no disco com debounce de 600ms
  useEffect(() => {
    if (isIncomingUpdateRef.current) {
      isIncomingUpdateRef.current = false
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const currentNodes = nodes
    const currentEdges = edges

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void saveGraph(currentNodes, currentEdges)
    }, 600)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [nodes, edges, saveGraph])

  return {
    isConnected,
    isSyncing,
    vaultPath,
    lastSyncTime,
    forceSave,
    forceReload,
  }
}
