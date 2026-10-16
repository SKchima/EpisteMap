import { create } from 'zustand'
import type { EpistemapStore, KnowledgeNode, KnowledgeEdge } from './types'
import { getSubtreeIds, canReparent, sanitizeGraph } from './graph'
import { findFreePosition, applyDagreLayout } from './layout'

function generateId(): string {
  return 'node_' + Math.random().toString(36).substring(2, 9)
}

function generateEdgeId(): string {
  return 'edge_' + Math.random().toString(36).substring(2, 9)
}

export const useGraphStore = create<EpistemapStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  focusId: null,

  addRootNode: (title = 'Novo Conceito', position) => {
    const state = get()
    const id = generateId()
    const freePos = position || findFreePosition(state.nodes, { x: 100, y: 100 })

    const newNode: KnowledgeNode = {
      id,
      parentId: null,
      position: freePos,
      data: {
        title,
        description: '',
        tags: [],
        color: null,
        collapsed: false,
      },
    }

    set({
      nodes: [...state.nodes, newNode],
      selectedId: id,
    })

    return id
  },

  addSubNode: (parentId, title = 'Novo Sub-objeto') => {
    const state = get()
    const parent = state.nodes.find((n) => n.id === parentId)
    if (!parent) {
      throw new Error(`Nó pai com id "${parentId}" não foi encontrado.`)
    }

    const id = generateId()
    const newNode: KnowledgeNode = {
      id,
      parentId,
      position: { x: 0, y: 0 },
      data: {
        title,
        description: '',
        tags: [...parent.data.tags],
        color: null,
        collapsed: false,
      },
    }

    set({
      nodes: [
        ...state.nodes.map((n) =>
          n.id === parentId ? { ...n, data: { ...n.data, collapsed: false } } : n
        ),
        newNode,
      ],
      selectedId: id,
    })

    return id
  },

  updateNode: (id, partial) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...partial } } : n
      ),
    }))
  },

  updateRootPosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }))
  },

  removeNode: (id) => {
    const state = get()
    const subtree = getSubtreeIds(state.nodes, id)

    let newFocusId = state.focusId
    if (state.focusId && subtree.has(state.focusId)) {
      const removedTarget = state.nodes.find((n) => n.id === id)
      newFocusId = removedTarget?.parentId || null
    }

    set({
      nodes: state.nodes.filter((n) => !subtree.has(n.id)),
      edges: state.edges.filter(
        (e) => !subtree.has(e.source) && !subtree.has(e.target)
      ),
      selectedId: state.selectedId && subtree.has(state.selectedId) ? null : state.selectedId,
      focusId: newFocusId,
    })
  },

  reparentNode: (id, newParentId) => {
    const state = get()
    if (!canReparent(state.nodes, id, newParentId)) {
      return false
    }

    set({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n
        return {
          ...n,
          parentId: newParentId,
        }
      }),
    })

    return true
  },

  toggleCollapse: (id) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
      ),
    }))
  },

  addEdge: (source, target, label = '') => {
    if (source === target) return ''
    const state = get()
    const exists = state.edges.some((e) => e.source === source && e.target === target)
    if (exists) return ''

    const id = generateEdgeId()
    const newEdge: KnowledgeEdge = { id, source, target, label }

    set({
      edges: [...state.edges, newEdge],
    })

    return id
  },

  removeEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }))
  },

  select: (id) => {
    set({ selectedId: id })
  },

  setFocus: (id) => {
    set({ focusId: id })
  },

  organizeMap: () => {
    set((state) => ({
      nodes: applyDagreLayout(state.nodes, state.edges),
    }))
  },

  loadGraph: (graph) => {
    const sanitized = sanitizeGraph(graph)
    set({
      nodes: sanitized.nodes,
      edges: sanitized.edges,
      selectedId: null,
      focusId: null,
    })
  },

  resetGraph: () => {
    set({
      nodes: [],
      edges: [],
      selectedId: null,
      focusId: null,
    })
  },
}))
