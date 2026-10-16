import React, { useEffect, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'

import { useGraphStore } from './core/graphStore'
import { initialSeedNodes, initialSeedEdges } from './core/seedData'
import type { EpistemeNode } from './core/types'
import { CompoundNode } from './components/CompoundNode'
import { BreadcrumbsBar } from './components/BreadcrumbsBar'
import { NodeInspector } from './components/NodeInspector'

const STORAGE_KEY = 'epistemap_state_v1'

export const App: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const selectNode = useGraphStore((s) => s.selectNode)

  const nodeTypes = useMemo(() => ({ compound: CompoundNode }), [])

  // Inicialização Local-First com recuperação de LocalStorage ou Semente Inicial
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.nodes && parsed.edges && parsed.nodes.length > 0) {
          loadGraph(parsed.nodes, parsed.edges)
          return
        }
      }
    } catch (err) {
      console.warn('Falha ao restaurar estado do LocalStorage:', err)
    }

    // Carrega dados semente iniciais
    loadGraph(initialSeedNodes, initialSeedEdges)
  }, [loadGraph])

  // Persistência contínua Local-First
  useEffect(() => {
    if (nodes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }))
    }
  }, [nodes, edges])

  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (focusNodeId === null) {
      const nodeMap = new Map<string, EpistemeNode>(nodes.map((n) => [n.id, n]))
      const isVisible = (node: EpistemeNode): boolean => {
        if (!node.parentId) return true
        let currentParent = nodeMap.get(node.parentId)
        while (currentParent) {
          if (!currentParent.data.isExpanded) return false
          currentParent = currentParent.parentId ? nodeMap.get(currentParent.parentId) : undefined
        }
        return true
      }
      const vNodes = nodes.filter(isVisible)
      const vNodeIds = new Set(vNodes.map((n) => n.id))
      const vEdges = edges.filter((e) => vNodeIds.has(e.source) && vNodeIds.has(e.target))
      return { visibleNodes: vNodes, visibleEdges: vEdges }
    }

    // Modo Drill-down focado
    const allIds = new Set<string>([focusNodeId])
    let addedMore = true
    while (addedMore) {
      addedMore = false
      for (const node of nodes) {
        if (node.parentId && allIds.has(node.parentId) && !allIds.has(node.id)) {
          allIds.add(node.id)
          addedMore = true
        }
      }
    }

    const vNodes = nodes.filter((n) => allIds.has(n.id))
    const vNodeIds = new Set(vNodes.map((n) => n.id))
    const vEdges = edges.filter((e) => vNodeIds.has(e.source) && vNodeIds.has(e.target))
    return { visibleNodes: vNodes, visibleEdges: vEdges }
  }, [nodes, edges, focusNodeId])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectNode(node.id)
    },
    [selectNode]
  )

  const handlePaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

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
      {/* Barra Superior com Breadcrumbs */}
      <BreadcrumbsBar />

      {/* Área Central: Canvas do Grafo + Inspetor de Conhecimento */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            colorMode="dark"
            style={{ backgroundColor: '#0e111a' }}
          >
            <Background color="#1f2537" gap={20} size={1.2} variant={BackgroundVariant.Dots} />
            <Controls
              style={{
                backgroundColor: '#181c28',
                border: '1px solid #2d3448',
                borderRadius: '6px',
                fill: '#94a3b8',
              }}
            />
            <MiniMap
              nodeColor="#4f46e5"
              maskColor="rgba(14, 17, 26, 0.75)"
              style={{
                backgroundColor: '#141824',
                border: '1px solid #282f42',
                borderRadius: '6px',
              }}
            />
          </ReactFlow>
        </div>

        {/* Inspetor Lateral de Nós (Markdown + LaTeX + Sub-objetos) */}
        <NodeInspector />
      </div>
    </div>
  )
}

export default App
