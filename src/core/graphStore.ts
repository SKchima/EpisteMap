import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge as rfAddEdge } from '@xyflow/react'
import type { EpistemapState, EpistemeNode, EpistemeEdge, BreadcrumbItem, EpistemeNodeData } from './types'

function generateId(): string {
  return 'node_' + Math.random().toString(36).substring(2, 9)
}

function generateEdgeId(): string {
  return 'edge_' + Math.random().toString(36).substring(2, 9)
}

// Retorna todos os IDs descendentes de um conjunto de nós (recursivo)
function getAllDescendantIds(nodes: EpistemeNode[], parentIds: Set<string>): Set<string> {
  const allIds = new Set<string>(parentIds)
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

  return allIds
}

export const useGraphStore = create<EpistemapState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  focusNodeId: null,

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }))
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }))
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: rfAddEdge(
        { ...connection, animated: true, id: generateEdgeId() },
        state.edges
      ),
    }))
  },

  addNode: (nodeData) => {
    const id = nodeData.id || generateId()
    const nodeDataObj: EpistemeNodeData = {
      title: nodeData.data?.title || 'Novo Conceito',
      description: nodeData.data?.description || '',
      tags: nodeData.data?.tags || [],
      isExpanded: nodeData.data?.isExpanded !== undefined ? nodeData.data.isExpanded : true,
      ...(nodeData.data || {}),
    }

    const newNode: EpistemeNode = {
      ...nodeData,
      id,
      type: nodeData.type || 'compound',
      data: nodeDataObj,
    }

    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
    }))

    return id
  },

  addSubNode: (parentId, title = 'Novo Sub-objeto') => {
    const state = get()
    const parentNode = state.nodes.find((n) => n.id === parentId)
    if (!parentNode) {
      throw new Error(`Nó pai com id "${parentId}" não foi encontrado.`)
    }

    // Conta quantos filhos imediatos já existem para calcular um deslocamento relativo
    const existingChildren = state.nodes.filter((n) => n.parentId === parentId)
    const childOffset = {
      x: 30 + (existingChildren.length % 2) * 160,
      y: 60 + Math.floor(existingChildren.length / 2) * 90,
    }

    const subNodeId = generateId()
    const subNode: EpistemeNode = {
      id: subNodeId,
      type: 'compound',
      parentId,
      extent: 'parent',
      position: childOffset,
      data: {
        title,
        description: '',
        tags: [...(parentNode.data.tags || [])],
        parentId,
        isExpanded: true,
      },
    }

    set((s) => ({
      nodes: [
        ...s.nodes.map((n) =>
          n.id === parentId
            ? { ...n, data: { ...n.data, isExpanded: true } }
            : n
        ),
        subNode,
      ],
      selectedNodeId: subNodeId,
    }))

    return subNodeId
  },

  updateNodeData: (id, partialData) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...partialData,
            },
          }
        }
        return node
      }),
    }))
  },

  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === id ? { ...node, position } : node)),
    }))
  },

  removeNode: (id) => {
    const state = get()
    const idsToRemove = getAllDescendantIds(state.nodes, new Set([id]))

    set((s) => ({
      nodes: s.nodes.filter((node) => !idsToRemove.has(node.id)),
      edges: s.edges.filter(
        (edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target)
      ),
      selectedNodeId: idsToRemove.has(s.selectedNodeId ?? '') ? null : s.selectedNodeId,
      focusNodeId: idsToRemove.has(s.focusNodeId ?? '') ? null : s.focusNodeId,
    }))
  },

  toggleNodeExpansion: (id) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              isExpanded: !node.data.isExpanded,
            },
          }
        }
        return node
      }),
    }))
  },

  addEdge: (edge) => {
    const id = edge.id || generateEdgeId()
    const newEdge: EpistemeEdge = {
      id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.animated,
    }

    set((state) => {
      // Evita duplicatas exatas de source e target
      const exists = state.edges.some(
        (e) => e.source === edge.source && e.target === edge.target
      )
      if (exists) return state
      return {
        edges: [...state.edges, newEdge],
      }
    })
  },

  removeEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }))
  },

  selectNode: (id) => {
    set({ selectedNodeId: id })
  },

  setFocusNode: (id) => {
    set({ focusNodeId: id })
  },

  getBreadcrumbs: () => {
    const { nodes, focusNodeId } = get()
    const trail: BreadcrumbItem[] = [{ id: null, title: 'Visão Geral' }]

    if (!focusNodeId) {
      return trail
    }

    const nodeMap = new Map<string, EpistemeNode>()
    for (const node of nodes) {
      nodeMap.set(node.id, node)
    }

    const chain: BreadcrumbItem[] = []
    let currentId: string | undefined = focusNodeId

    while (currentId) {
      const node = nodeMap.get(currentId)
      if (!node) break
      chain.unshift({ id: node.id, title: node.data.title })
      currentId = node.parentId
    }

    return [...trail, ...chain]
  },

  getVisibleElements: () => {
    const { nodes, edges, focusNodeId } = get()

    if (focusNodeId === null) {
      // Modo global: Nós raiz sempre visíveis; nós filhos visíveis se o pai estiver expandido
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

      const visibleNodes = nodes.filter(isVisible)
      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
      const visibleEdges = edges.filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      )

      return { nodes: visibleNodes, edges: visibleEdges }
    }

    // Modo Drill-down focado em um nó
    const descendants = getAllDescendantIds(nodes, new Set([focusNodeId]))
    const visibleNodes = nodes.filter((n) => descendants.has(n.id))
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
    const visibleEdges = edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    )

    return { nodes: visibleNodes, edges: visibleEdges }
  },

  loadGraph: (nodes, edges) => {
    set({
      nodes,
      edges,
      selectedNodeId: null,
      focusNodeId: null,
    })
  },

  resetGraph: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      focusNodeId: null,
    })
  },
}))
