import React, { useEffect, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type Connection,
  type Node as RFNode,
  type OnNodeDrag,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'

import { useGraphStore } from './core/graphStore'
import { initialSeedNodes, initialSeedEdges } from './core/seedData'
import { buildFlowElements } from './core/layout'
import { sanitizeGraph } from './core/graph'
import { CompoundNode } from './components/CompoundNode'
import { BreadcrumbsBar } from './components/BreadcrumbsBar'
import { NodeInspector } from './components/NodeInspector'

const STORAGE_KEY_V2 = 'epistemap:v2'
const STORAGE_KEY_V1 = 'epistemap_state_v1'

const EpistemapCanvas: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const focusId = useGraphStore((s) => s.focusId)
  const selectedId = useGraphStore((s) => s.selectedId)
  const select = useGraphStore((s) => s.select)
  const setFocus = useGraphStore((s) => s.setFocus)
  const addEdge = useGraphStore((s) => s.addEdge)
  const addRootNode = useGraphStore((s) => s.addRootNode)
  const updateRootPosition = useGraphStore((s) => s.updateRootPosition)
  const loadGraph = useGraphStore((s) => s.loadGraph)

  const { screenToFlowPosition, fitView } = useReactFlow()

  const nodeTypes = useMemo(() => ({ compound: CompoundNode }), [])

  // Inicialização Local-First com migração transparente
  useEffect(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_KEY_V2)
      if (savedV2) {
        const parsed = JSON.parse(savedV2)
        if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          loadGraph(sanitizeGraph(parsed))
          return
        }
      }

      // Tenta migrar dados da v1 se existirem
      const savedV1 = localStorage.getItem(STORAGE_KEY_V1)
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1)
        if (parsedV1 && Array.isArray(parsedV1.nodes) && parsedV1.nodes.length > 0) {
          const migrated = sanitizeGraph(parsedV1)
          loadGraph(migrated)
          localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated))
          localStorage.removeItem(STORAGE_KEY_V1)
          return
        }
      }
    } catch (err) {
      console.warn('Falha ao restaurar dados salvos:', err)
    }

    // Carrega dados semente iniciais distribuídos
    loadGraph({ nodes: initialSeedNodes, edges: initialSeedEdges })
  }, [loadGraph])

  // Persistência contínua Local-First
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ nodes, edges }))
    }
  }, [nodes, edges])

  // Projeção visual pura e memoizada
  const { flowNodes, flowEdges } = useMemo(() => {
    return buildFlowElements(nodes, edges, { focusId, selectedId })
  }, [nodes, edges, focusId, selectedId])

  // Ajusta visão da câmera ao alternar foco/drill-down
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 300 })
    }, 50)
    return () => clearTimeout(timer)
  }, [focusId, fitView])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      select(node.id)
    },
    [select]
  )

  const handlePaneClick = useCallback(() => {
    select(null)
  }, [select])

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_, node) => {
      const domainNode = nodes.find((n) => n.id === node.id)
      if (domainNode && domainNode.parentId === null && focusId === null) {
        updateRootPosition(node.id, {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        })
      }
    },
    [nodes, focusId, updateRootPosition]
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
      // Ignora se o clique foi em um nó
      const target = event.target as HTMLElement
      if (target.closest('.react-flow__node')) return

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

  // Atalhos de teclado: Esc (limpar seleção / subir nível), Delete/Backspace (excluir nó)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Não intercepta se o foco estiver num input ou textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'Escape') {
        if (selectedId) {
          select(null)
        } else if (focusId) {
          const focusedNode = nodes.find((n) => n.id === focusId)
          setFocus(focusedNode?.parentId || null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, focusId, nodes, select, setFocus])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0d1017',
        color: '#e2e8f0',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <BreadcrumbsBar />

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{ flex: 1, height: '100%', position: 'relative' }}
          onDoubleClick={handleDoubleClick}
        >
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            colorMode="dark"
            style={{ backgroundColor: '#0e111a' }}
          >
            <Background color="#1f2537" gap={24} size={1.2} variant={BackgroundVariant.Dots} />
            <Controls
              style={{
                backgroundColor: '#181c28',
                border: '1px solid #2d3448',
                borderRadius: '6px',
                fill: '#94a3b8',
              }}
            />
            <MiniMap
              nodeColor={(n) => ((n.data as { color?: string })?.color || '#4f46e5')}
              maskColor="rgba(14, 17, 26, 0.75)"
              style={{
                backgroundColor: '#141824',
                border: '1px solid #282f42',
                borderRadius: '6px',
              }}
            />
          </ReactFlow>
        </div>

        <NodeInspector />
      </div>
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <EpistemapCanvas />
    </ReactFlowProvider>
  )
}

export default App
