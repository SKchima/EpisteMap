import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  type OnNodeDrag,
  type OnNodesChange,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'

import { useGraphStore } from './core/graphStore'
import { initialSeedNodes, initialSeedEdges } from './core/seedData'
import {
  buildFlowElements,
  computeNodeBoundingBoxes,
  findDropTargetNodeId,
  findFreePosition,
  LEAF_WIDTH,
  LEAF_HEIGHT,
  HEADER_HEIGHT,
} from './core/layout'
import { sanitizeGraph, getSubtreeIds } from './core/graph'
import { CompoundNode } from './components/CompoundNode'
import { BreadcrumbsBar } from './components/BreadcrumbsBar'
import { NodeInspector } from './components/NodeInspector'
import { CommandPalette } from './components/CommandPalette'
import { SettingsModal, type SettingsTab } from './components/SettingsModal'
import { ErrorBoundary } from './components/ErrorBoundary'

const STORAGE_KEY_V2 = 'epistemap:v2'
const STORAGE_KEY_V1 = 'epistemap_state_v1'

const EpistemapCanvas: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const focusId = useGraphStore((s) => s.focusId)
  const selectedId = useGraphStore((s) => s.selectedId)
  const activeTag = useGraphStore((s) => s.activeTag)
  const theme = useGraphStore((s) => s.theme)
  const select = useGraphStore((s) => s.select)
  const setFocus = useGraphStore((s) => s.setFocus)
  const addEdge = useGraphStore((s) => s.addEdge)
  const removeEdge = useGraphStore((s) => s.removeEdge)
  const addRootNode = useGraphStore((s) => s.addRootNode)
  const addSubNode = useGraphStore((s) => s.addSubNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const reparentNode = useGraphStore((s) => s.reparentNode)
  const updateRootPosition = useGraphStore((s) => s.updateRootPosition)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)

  const { screenToFlowPosition, fitView } = useReactFlow()

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('backup')
  const [isConnecting, setIsConnecting] = useState(false)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null)
  const isHydrated = useRef(false)
  const focusFitViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nodeTypes = useMemo(() => ({ compound: CompoundNode }), [])

  // Inicialização Local-First com migração transparente e histórico limpo
  useEffect(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_KEY_V2)
      if (savedV2) {
        const parsed = JSON.parse(savedV2)
        if (parsed && Array.isArray(parsed.nodes)) {
          loadGraph(sanitizeGraph(parsed))
          useGraphStore.temporal.getState().clear()
          isHydrated.current = true
          return
        }
      }

      // Tenta migrar dados da v1 se existirem
      const savedV1 = localStorage.getItem(STORAGE_KEY_V1)
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1)
        if (parsedV1 && Array.isArray(parsedV1.nodes)) {
          const migrated = sanitizeGraph(parsedV1)
          loadGraph(migrated)
          useGraphStore.temporal.getState().clear()
          localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated))
          localStorage.removeItem(STORAGE_KEY_V1)
          isHydrated.current = true
          return
        }
      }
    } catch (err) {
      console.warn('Falha ao restaurar dados salvos:', err)
    }

    // Carrega dados semente iniciais distribuídos apenas na primeira execução
    loadGraph({ nodes: initialSeedNodes, edges: initialSeedEdges })
    useGraphStore.temporal.getState().clear()
    isHydrated.current = true
  }, [loadGraph])

  // Persistência contínua Local-First (incluindo estado vazio para respeitar exclusão total)
  useEffect(() => {
    if (!isHydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ nodes, edges }))
    } catch (err) {
      console.warn('Falha ao persistir no localStorage (possível limite de cota com anexos PDF):', err)
    }
  }, [nodes, edges])

  // Projeção visual pura e memoizada
  const { flowNodes, flowEdges } = useMemo(() => {
    return buildFlowElements(nodes, edges, {
      focusId,
      selectedId,
      dropTargetId,
      activeTag,
    })
  }, [nodes, edges, focusId, selectedId, dropTargetId, activeTag])

  // Sobrepõe coordenadas efêmeras durante arraste para que nós controlados se movam suavemente
  const renderedFlowNodes = useMemo(() => {
    const draggedIds = Object.keys(dragPositions)
    if (draggedIds.length === 0) return flowNodes
    return flowNodes.map((n) => {
      const dragPos = dragPositions[n.id]
      return dragPos ? { ...n, position: dragPos } : n
    })
  }, [flowNodes, dragPositions])

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    const positionChanges = changes.filter(
      (c): c is Extract<typeof c, { type: 'position' }> =>
        c.type === 'position' && c.position !== undefined
    )
    if (positionChanges.length === 0) return

    setDragPositions((prev) => {
      let next: Record<string, { x: number; y: number }> | null = null
      for (const change of positionChanges) {
        if (change.dragging && change.position) {
          if (!next) next = { ...prev }
          next[change.id] = change.position
        } else if (prev[change.id]) {
          if (!next) next = { ...prev }
          delete next[change.id]
        }
      }
      return next ?? prev
    })
  }, [])

  const prevFocusRef = useRef<string | null>(focusId)

  // Ajusta visão da câmera ao alternar foco/drill-down
  useEffect(() => {
    const isSubtree = Boolean(focusId)
    prevFocusRef.current = focusId

    focusFitViewTimerRef.current = setTimeout(() => {
      focusFitViewTimerRef.current = null
      fitView({ padding: isSubtree ? 0.3 : 0.25, duration: 250 })
    }, 40)
    return () => {
      if (focusFitViewTimerRef.current) {
        clearTimeout(focusFitViewTimerRef.current)
        focusFitViewTimerRef.current = null
      }
    }
  }, [focusId, fitView])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      select(node.id)
    },
    [select]
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: RFEdge) => {
      select(edge.id)
    },
    [select]
  )

  const handlePaneClick = useCallback(() => {
    select(null)
  }, [select])

  // Calcula posição absoluta e centro (geométrico + cabeçalho) do nó arrastado no canvas
  const getDraggedNodeGeometry = useCallback(
    (draggedRfNode: RFNode) => {
      const boxes = computeNodeBoundingBoxes(flowNodes)
      const parentBox = draggedRfNode.parentId
        ? boxes.get(draggedRfNode.parentId)
        : undefined
      const absX = (parentBox?.x || 0) + draggedRfNode.position.x
      const absY = (parentBox?.y || 0) + draggedRfNode.position.y
      const data = (draggedRfNode.data || {}) as { width?: number; height?: number }
      const width = data.width || LEAF_WIDTH
      const height = data.height || LEAF_HEIGHT
      return {
        absX,
        absY,
        center: {
          x: absX + width / 2,
          y: absY + height / 2,
        },
        headerCenter:
          height > LEAF_HEIGHT
            ? {
                x: absX + width / 2,
                y: absY + HEADER_HEIGHT / 2,
              }
            : null,
      }
    },
    [flowNodes]
  )

  const handleNodeDrag: OnNodeDrag = useCallback(
    (_, draggedNode) => {
      const domainNode = nodes.find((n) => n.id === draggedNode.id)
      if (!domainNode) return

      const { center, headerCenter } = getDraggedNodeGeometry(draggedNode)
      const targetId =
        findDropTargetNodeId(nodes, flowNodes, draggedNode.id, center) ??
        (headerCenter
          ? findDropTargetNodeId(nodes, flowNodes, draggedNode.id, headerCenter)
          : null)

      if (targetId && targetId !== domainNode.parentId) {
        setDropTargetId(targetId)
      } else {
        setDropTargetId(null)
      }
    },
    [nodes, flowNodes, getDraggedNodeGeometry]
  )

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_, draggedNode) => {
      setDropTargetId(null)
      setDragPositions({})
      const domainNode = nodes.find((n) => n.id === draggedNode.id)
      if (!domainNode) return

      const { absX, absY, center, headerCenter } = getDraggedNodeGeometry(draggedNode)
      const targetId =
        findDropTargetNodeId(nodes, flowNodes, draggedNode.id, center) ??
        (headerCenter
          ? findDropTargetNodeId(nodes, flowNodes, draggedNode.id, headerCenter)
          : null)

      if (targetId && targetId !== domainNode.parentId) {
        reparentNode(draggedNode.id, targetId)
        return
      }

      if (!targetId && domainNode.parentId !== null && focusId === null) {
        // Sub-objeto arrastado para fora do contêiner vira conceito raiz na posição solta
        reparentNode(draggedNode.id, null, {
          x: Math.round(absX),
          y: Math.round(absY),
        })
        return
      }

      if (domainNode.parentId === null && focusId === null) {
        updateRootPosition(draggedNode.id, {
          x: Math.round(draggedNode.position.x),
          y: Math.round(draggedNode.position.y),
        })
      }
    },
    [nodes, flowNodes, focusId, getDraggedNodeGeometry, reparentNode, updateRootPosition]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(connection.source, connection.target)
      }
    },
    [addEdge]
  )

  // Duplo clique no canvas cria conceito diretamente no ponto clicado
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return

      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      addRootNode('Novo Conceito', {
        x: Math.round(flowPos.x),
        y: Math.round(flowPos.y),
      })
    },
    [screenToFlowPosition, addRootNode]
  )

  const handleSearchNavigate = useCallback(
    (nodeId: string) => {
      setTimeout(() => {
        if (focusFitViewTimerRef.current) {
          clearTimeout(focusFitViewTimerRef.current)
          focusFitViewTimerRef.current = null
        }
        fitView({
          nodes: [{ id: nodeId }],
          duration: 500,
          padding: 0.35,
        })
      }, 50)
    },
    [fitView]
  )

  // Atalhos globais de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      // Cmd+K / Ctrl+K: Busca Global
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
        return
      }

      // Cmd+, / Ctrl+,: Configurações & Backups
      if (isMod && e.key === ',') {
        e.preventDefault()
        setIsSettingsOpen((prev) => !prev)
        return
      }

      const target = e.target as HTMLElement
      const isEditingInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (isEditingInput) return

      // ?: Atalhos de Teclado
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setSettingsTab('shortcuts')
        setIsSettingsOpen(true)
        return
      }

      // Undo / Redo
      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false)
        } else if (pendingDeleteNodeId) {
          setPendingDeleteNodeId(null)
        } else if (selectedId) {
          select(null)
        } else if (focusId) {
          const focusedNode = nodes.find((n) => n.id === focusId)
          setFocus(focusedNode?.parentId || null)
        }
        return
      }

      if (isSearchOpen || pendingDeleteNodeId) return

      const selectedNode = nodes.find((n) => n.id === selectedId)
      const selectedEdge = edges.find((edge) => edge.id === selectedId)

      // Tab: cria sub-objeto do nó selecionado
      if (e.key === 'Tab' && selectedNode) {
        e.preventDefault()
        addSubNode(selectedNode.id)
        return
      }

      // Enter: cria conceito irmão do nó selecionado
      if (e.key === 'Enter' && selectedNode) {
        e.preventDefault()
        if (selectedNode.parentId) {
          addSubNode(selectedNode.parentId)
        } else {
          const freePos = findFreePosition(nodes, {
            x: selectedNode.position.x + 280,
            y: selectedNode.position.y,
          })
          addRootNode('Novo Conceito', freePos)
        }
        return
      }

      // Delete / Backspace: remove nó ou aresta selecionada
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdge) {
          e.preventDefault()
          removeEdge(selectedEdge.id)
        } else if (selectedNode) {
          e.preventDefault()
          const hasDescendants = nodes.some((n) => n.parentId === selectedNode.id)
          if (hasDescendants) {
            setPendingDeleteNodeId(selectedNode.id)
          } else {
            removeNode(selectedNode.id)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isSearchOpen,
    pendingDeleteNodeId,
    selectedId,
    focusId,
    nodes,
    edges,
    select,
    setFocus,
    undo,
    redo,
    addSubNode,
    addRootNode,
    removeEdge,
    removeNode,
  ])

  const pendingDeleteNode = pendingDeleteNodeId
    ? nodes.find((n) => n.id === pendingDeleteNodeId)
    : undefined
  const pendingDeleteSubtreeCount = pendingDeleteNode
    ? getSubtreeIds(nodes, pendingDeleteNode.id).size - 1
    : 0

  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const appBg = isHighContrast ? '#ffffff' : isLight ? '#f8fafc' : '#0d1017'
  const appColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#e2e8f0'
  const canvasBg = isHighContrast ? '#ffffff' : isLight ? '#f8fafc' : '#0e111a'
  const gridColor = isHighContrast ? '#94a3b8' : isLight ? '#cbd5e1' : '#1f2537'
  const controlsBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#181c28'
  const controlsBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #2d3448'
  const controlsFill = isHighContrast ? '#000000' : isLight ? '#475569' : '#94a3b8'
  const minimapBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#141824'
  const minimapBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #282f42'
  const minimapMask = isHighContrast
    ? 'rgba(255, 255, 255, 0.85)'
    : isLight
      ? 'rgba(241, 245, 249, 0.75)'
      : 'rgba(14, 17, 26, 0.75)'

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: appBg,
        color: appColor,
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <BreadcrumbsBar
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => {
          setSettingsTab('backup')
          setIsSettingsOpen(true)
        }}
        onOpenShortcuts={() => {
          setSettingsTab('shortcuts')
          setIsSettingsOpen(true)
        }}
      />

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{ flex: 1, height: '100%', position: 'relative' }}
          onDoubleClick={handleDoubleClick}
        >
          <ReactFlow
            key={focusId ?? 'overview'}
            nodes={renderedFlowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onConnectStart={() => setIsConnecting(true)}
            onConnectEnd={() => setIsConnecting(false)}
            className={isConnecting ? 'is-connecting' : undefined}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: focusId ? 0.3 : 0.25 }}
            colorMode={theme === 'dark' ? 'dark' : 'light'}
            style={{ backgroundColor: canvasBg }}
          >
            <Background color={gridColor} gap={24} size={1.2} variant={BackgroundVariant.Dots} />
            <Controls
              style={{
                backgroundColor: controlsBg,
                border: controlsBorder,
                borderRadius: '6px',
                fill: controlsFill,
              }}
            />
            <MiniMap
              nodeColor={(n) =>
                isHighContrast ? '#000000' : (n.data as { color?: string })?.color || '#4f46e5'
              }
              maskColor={minimapMask}
              style={{
                backgroundColor: minimapBg,
                border: minimapBorder,
                borderRadius: '6px',
              }}
            />
          </ReactFlow>
        </div>

        <NodeInspector onNavigate={handleSearchNavigate} />
      </div>

      {/* Modal de Busca Global Cmd+K */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />

      {/* Modal de Configurações & Backups */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
      />

      {/* Modal de Confirmação ao Excluir Subárvore via Teclado */}
      {pendingDeleteNode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão de subárvore"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingDeleteNodeId(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: isHighContrast ? 'rgba(0, 0, 0, 0.45)' : 'rgba(9, 11, 17, 0.72)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#181b26',
              border: isHighContrast ? '2px solid #000000' : isLight ? '1px solid #ef4444' : '1px solid #7f1d1d',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: isHighContrast ? 'none' : '0 20px 40px rgba(0,0,0,0.6)',
              color: isHighContrast ? '#000000' : isLight ? '#0f172a' : '#f8fafc',
            }}
          >
            <h4
              style={{
                margin: '0 0 10px 0',
                color: isHighContrast ? '#000000' : isLight ? '#991b1b' : '#f8fafc',
                fontSize: '15px',
              }}
            >
              Confirmar Exclusão em Cascata
            </h4>
            <p
              style={{
                margin: '0 0 18px 0',
                color: isHighContrast ? '#000000' : isLight ? '#475569' : '#cbd5e1',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              Tem certeza que deseja excluir <strong>"{pendingDeleteNode.data.title}"</strong> e todos os seus{' '}
              <strong>{pendingDeleteSubtreeCount}</strong> sub-objeto(s) descendentes?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPendingDeleteNodeId(null)}
                style={{
                  background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#242a3a',
                  border: isHighContrast ? '1.5px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #374151',
                  color: isHighContrast ? '#000000' : isLight ? '#334155' : '#cbd5e1',
                  borderRadius: '5px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToRemove = pendingDeleteNode.id
                  setPendingDeleteNodeId(null)
                  removeNode(idToRemove)
                }}
                style={{
                  background: '#dc2626',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '5px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <EpistemapCanvas />
      </ReactFlowProvider>
    </ErrorBoundary>
  )
}

export default App
