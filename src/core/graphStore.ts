import { create } from 'zustand'
import { temporal } from 'zundo'
import type { EpistemapStore, KnowledgeNode, KnowledgeEdge, ThemeMode } from './types'
import {
  getSubtreeIds,
  getAncestorIds,
  canReparent,
  sanitizeGraph,
  findNodeByTitle,
} from './graph'
import { findFreePosition, applyDagreLayout } from './layout'

const THEME_STORAGE_KEY = 'epistemap:theme'
const INSPECTOR_STORAGE_KEY = 'epistemap:inspector-open'

export function getInitialInspectorOpen(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(INSPECTOR_STORAGE_KEY)
      if (saved !== null) {
        return saved === 'true'
      }
    }
  } catch {
    // fallback
  }
  return true
}

export function getInitialTheme(): ThemeMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'dark' || saved === 'light' || saved === 'high-contrast') {
        return saved
      }
    }
  } catch {
    // fallback
  }
  return 'dark'
}

export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

// Inicializa atributo no DOM no carregamento do módulo
applyThemeToDom(getInitialTheme())

function generateId(): string {
  return 'node_' + Math.random().toString(36).substring(2, 9)
}

function generateEdgeId(): string {
  return 'edge_' + Math.random().toString(36).substring(2, 9)
}

function sortNodesTopologically(nodes: KnowledgeNode[]): KnowledgeNode[] {
  const sorted: KnowledgeNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const added = new Set<string>()

  function visit(n: KnowledgeNode) {
    if (added.has(n.id)) return
    if (n.parentId && !added.has(n.parentId)) {
      const parent = nodeMap.get(n.parentId)
      if (parent) visit(parent)
    }
    added.add(n.id)
    sorted.push(n)
    for (const child of nodes) {
      if (child.parentId === n.id) {
        visit(child)
      }
    }
  }

  for (const n of nodes) {
    if (n.parentId === null) visit(n)
  }
  for (const n of nodes) {
    if (!added.has(n.id)) visit(n)
  }
  return sorted
}

function resolveValidActiveTag(
  nodes: KnowledgeNode[],
  activeTag: string | null
): string | null {
  if (!activeTag) return null
  return nodes.some((n) => n.data.tags.includes(activeTag)) ? activeTag : null
}

const TEXT_COALESCE_MS = 500
let lastTextEdit: { key: string; timestamp: number } | null = null
let pendingUndoFocusFallbackId: string | null = null

export const useGraphStore = create<EpistemapStore>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedId: null,
      focusId: null,
      activeTag: null,
      theme: getInitialTheme(),
      isInspectorOpen: getInitialInspectorOpen(),
      canUndo: false,
      canRedo: false,

      addRootNode: (title = 'Novo Conceito', position) => {
        lastTextEdit = null
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
            pdfAttachment: null,
          },
        }

        set({
          nodes: [...state.nodes, newNode],
          selectedId: id,
        })

        return id
      },

      addSubNode: (parentId, title = 'Novo Sub-objeto') => {
        lastTextEdit = null
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
            pdfAttachment: null,
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
        const state = get()
        const target = state.nodes.find((n) => n.id === id)
        if (!target) return

        const tagsChanged =
          partial.tags !== undefined &&
          (partial.tags.length !== target.data.tags.length ||
            partial.tags.some((t, idx) => t !== target.data.tags[idx]))
        const titleChanged =
          partial.title !== undefined && partial.title !== target.data.title
        const descChanged =
          partial.description !== undefined &&
          partial.description !== target.data.description
        const colorChanged =
          partial.color !== undefined && partial.color !== target.data.color
        const collapsedChanged =
          partial.collapsed !== undefined &&
          partial.collapsed !== target.data.collapsed
        const pdfChanged =
          partial.pdfAttachment !== undefined &&
          JSON.stringify(partial.pdfAttachment) !==
            JSON.stringify(target.data.pdfAttachment)

        if (
          !tagsChanged &&
          !titleChanged &&
          !descChanged &&
          !colorChanged &&
          !collapsedChanged &&
          !pdfChanged
        ) {
          return
        }

        const keys = Object.keys(partial)
        const isSingleTextEdit =
          keys.length === 1 && (keys[0] === 'title' || keys[0] === 'description')
        const now = Date.now()
        const editKey = isSingleTextEdit ? `node:${id}:${keys[0]}` : null

        const shouldCoalesce =
          editKey !== null &&
          lastTextEdit !== null &&
          lastTextEdit.key === editKey &&
          now - lastTextEdit.timestamp < TEXT_COALESCE_MS

        const nextNodes = state.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...partial } } : n
        )
        const nextActiveTag = resolveValidActiveTag(nextNodes, state.activeTag)

        if (shouldCoalesce) {
          const temporalStore = useGraphStore.temporal.getState()
          temporalStore.pause()
          set({ nodes: nextNodes, activeTag: nextActiveTag })
          temporalStore.resume()
          lastTextEdit = { key: editKey, timestamp: now }
        } else {
          set({ nodes: nextNodes, activeTag: nextActiveTag })
          lastTextEdit = editKey ? { key: editKey, timestamp: now } : null
        }
      },

      updateRootPosition: (id, position) => {
        lastTextEdit = null
        const state = get()
        const target = state.nodes.find((n) => n.id === id)
        if (!target) return
        if (target.position.x === position.x && target.position.y === position.y) {
          return
        }

        set({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
        })
      },

      removeNode: (id) => {
        lastTextEdit = null
        const state = get()
        if (!state.nodes.some((n) => n.id === id)) return

        const subtree = getSubtreeIds(state.nodes, id)

        let newFocusId = state.focusId
        if (state.focusId && subtree.has(state.focusId)) {
          const removedTarget = state.nodes.find((n) => n.id === id)
          newFocusId = removedTarget?.parentId || null
        }

        const removedEdgeIds = new Set(
          state.edges
            .filter((e) => subtree.has(e.source) || subtree.has(e.target))
            .map((e) => e.id)
        )

        const shouldClearSelection =
          state.selectedId !== null &&
          (subtree.has(state.selectedId) || removedEdgeIds.has(state.selectedId))

        const nextNodes = state.nodes.filter((n) => !subtree.has(n.id))

        set({
          nodes: nextNodes,
          edges: state.edges.filter(
            (e) => !subtree.has(e.source) && !subtree.has(e.target)
          ),
          selectedId: shouldClearSelection ? null : state.selectedId,
          focusId: newFocusId,
          activeTag: resolveValidActiveTag(nextNodes, state.activeTag),
        })
      },

      reparentNode: (id, newParentId, position) => {
        lastTextEdit = null
        const state = get()
        const target = state.nodes.find((n) => n.id === id)
        if (!target) return false
        if (!canReparent(state.nodes, id, newParentId)) {
          return false
        }

        let resolvedPosition = position ?? target.position
        if (target.parentId !== null && newParentId === null && !position) {
          let rootAncestor: KnowledgeNode | undefined = target
          while (rootAncestor && rootAncestor.parentId) {
            rootAncestor = state.nodes.find((n) => n.id === rootAncestor!.parentId)
          }
          const startPos = rootAncestor
            ? { x: rootAncestor.position.x + 280, y: rootAncestor.position.y }
            : { x: 100, y: 100 }
          resolvedPosition = findFreePosition(state.nodes, startPos)
        }

        if (
          target.parentId === newParentId &&
          target.position.x === resolvedPosition.x &&
          target.position.y === resolvedPosition.y
        ) {
          return true
        }

        const updatedNodes = state.nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              parentId: newParentId,
              position: resolvedPosition,
            }
          }
          if (newParentId !== null && n.id === newParentId && n.data.collapsed) {
            return {
              ...n,
              data: { ...n.data, collapsed: false },
            }
          }
          return n
        })

        set({
          nodes: sortNodesTopologically(updatedNodes),
        })

        return true
      },

      toggleCollapse: (id) => {
        lastTextEdit = null
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
          ),
        }))
      },

      createNodeFromWikiLink: (sourceNodeId, targetTitle) => {
        lastTextEdit = null
        const state = get()
        const cleanTitle = targetTitle.trim() || 'Novo Conceito'
        const existing = findNodeByTitle(state.nodes, cleanTitle)
        if (existing) {
          const edgeExists = state.edges.some(
            (e) =>
              (e.source === sourceNodeId && e.target === existing.id) ||
              (e.source === existing.id && e.target === sourceNodeId)
          )
          const nextEdges =
            !edgeExists &&
            sourceNodeId !== existing.id &&
            state.nodes.some((n) => n.id === sourceNodeId)
              ? [
                  ...state.edges,
                  {
                    id: generateEdgeId(),
                    source: sourceNodeId,
                    target: existing.id,
                    label: '',
                  },
                ]
              : state.edges

          const ancestorIds = new Set(getAncestorIds(state.nodes, existing.id))
          const hasCollapsedAncestor = state.nodes.some(
            (n) => ancestorIds.has(n.id) && n.data.collapsed
          )
          const nextNodes = hasCollapsedAncestor
            ? state.nodes.map((n) =>
                ancestorIds.has(n.id) && n.data.collapsed
                  ? { ...n, data: { ...n.data, collapsed: false } }
                  : n
              )
            : state.nodes

          let nextFocusId = state.focusId
          if (state.focusId !== null) {
            const focusSubtree = getSubtreeIds(state.nodes, state.focusId)
            if (!focusSubtree.has(existing.id)) {
              nextFocusId = null
            }
          }

          set({
            nodes: nextNodes,
            edges: nextEdges,
            selectedId: existing.id,
            focusId: nextFocusId,
          })
          return existing.id
        }

        let rootNode = state.nodes.find((n) => n.id === sourceNodeId)
        while (rootNode && rootNode.parentId) {
          rootNode = state.nodes.find((n) => n.id === rootNode!.parentId)
        }
        const startPos = rootNode
          ? { x: rootNode.position.x + 280, y: rootNode.position.y }
          : { x: 200, y: 150 }
        const freePos = findFreePosition(state.nodes, startPos)

        const newId = generateId()
        const newNode: KnowledgeNode = {
          id: newId,
          parentId: null,
          position: freePos,
          data: {
            title: cleanTitle,
            description: '',
            tags: [],
            color: null,
            collapsed: false,
            pdfAttachment: null,
          },
        }

        const newEdges =
          sourceNodeId && state.nodes.some((n) => n.id === sourceNodeId)
            ? [
                ...state.edges,
                { id: generateEdgeId(), source: sourceNodeId, target: newId, label: '' },
              ]
            : state.edges

        set({
          nodes: [...state.nodes, newNode],
          edges: newEdges,
          selectedId: newId,
          focusId: null,
        })

        return newId
      },

      attachPdf: (nodeId, attachment) => {
        lastTextEdit = null
        const state = get()
        const target = state.nodes.find((n) => n.id === nodeId)
        if (!target) return

        set({
          nodes: state.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    pdfAttachment: {
                      name: attachment.name || 'documento.pdf',
                      base64: attachment.base64,
                      page: Math.max(1, attachment.page || 1),
                    },
                  },
                }
              : n
          ),
        })
      },

      removePdf: (nodeId) => {
        lastTextEdit = null
        const state = get()
        const target = state.nodes.find((n) => n.id === nodeId)
        if (!target) return

        set({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n
            const nextData = { ...n.data }
            delete nextData.pdfAttachment
            return {
              ...n,
              data: nextData,
            }
          }),
        })
      },

      setPdfPage: (nodeId, page) => {
        const state = get()
        const target = state.nodes.find((n) => n.id === nodeId)
        if (!target || !target.data.pdfAttachment) return
        const validPage = Math.max(1, page)
        if (target.data.pdfAttachment.page === validPage) return

        set({
          nodes: state.nodes.map((n) =>
            n.id === nodeId && n.data.pdfAttachment
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    pdfAttachment: {
                      ...n.data.pdfAttachment,
                      page: validPage,
                    },
                  },
                }
              : n
          ),
        })
      },

      addEdge: (source, target, label = '') => {
        lastTextEdit = null
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

      updateEdgeLabel: (edgeId, label) => {
        const state = get()
        const target = state.edges.find((e) => e.id === edgeId)
        if (!target || target.label === label) return

        const now = Date.now()
        const editKey = `edge:${edgeId}:label`
        const shouldCoalesce =
          lastTextEdit !== null &&
          lastTextEdit.key === editKey &&
          now - lastTextEdit.timestamp < TEXT_COALESCE_MS

        const nextEdges = state.edges.map((e) => (e.id === edgeId ? { ...e, label } : e))

        if (shouldCoalesce) {
          const temporalStore = useGraphStore.temporal.getState()
          temporalStore.pause()
          set({ edges: nextEdges })
          temporalStore.resume()
          lastTextEdit = { key: editKey, timestamp: now }
        } else {
          set({ edges: nextEdges })
          lastTextEdit = { key: editKey, timestamp: now }
        }
      },

      removeEdge: (edgeId) => {
        lastTextEdit = null
        const state = get()
        if (!state.edges.some((e) => e.id === edgeId)) return
        set({
          edges: state.edges.filter((e) => e.id !== edgeId),
          selectedId: state.selectedId === edgeId ? null : state.selectedId,
        })
      },

      select: (id) => {
        set({ selectedId: id })
      },

      setFocus: (id) => {
        set({ focusId: id })
      },

      setActiveTag: (tag) => {
        set({ activeTag: tag })
      },

      setTheme: (theme) => {
        set({ theme })
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(THEME_STORAGE_KEY, theme)
          }
        } catch (err) {
          console.warn('Falha ao salvar tema no localStorage:', err)
        }
        applyThemeToDom(theme)
      },

      navigateToNode: (nodeId) => {
        lastTextEdit = null
        const state = get()
        const target = state.nodes.find((n) => n.id === nodeId)
        if (!target) return

        const ancestorIds = new Set(getAncestorIds(state.nodes, nodeId))
        const hasCollapsedAncestor = state.nodes.some(
          (n) => ancestorIds.has(n.id) && n.data.collapsed
        )

        const updatedNodes = hasCollapsedAncestor
          ? state.nodes.map((n) =>
              ancestorIds.has(n.id) && n.data.collapsed
                ? { ...n, data: { ...n.data, collapsed: false } }
                : n
            )
          : state.nodes

        let nextFocusId = state.focusId
        if (state.focusId !== null) {
          const focusSubtree = getSubtreeIds(state.nodes, state.focusId)
          if (!focusSubtree.has(nodeId)) {
            nextFocusId = null
          }
        }

        let nextActiveTag = state.activeTag
        if (state.activeTag !== null) {
          const targetSubtree = getSubtreeIds(updatedNodes, nodeId)
          const matchesActiveTag = updatedNodes.some(
            (n) => targetSubtree.has(n.id) && n.data.tags.includes(state.activeTag!)
          )
          if (!matchesActiveTag) {
            nextActiveTag = null
          }
        }

        set({
          nodes: updatedNodes,
          focusId: nextFocusId,
          selectedId: nodeId,
          activeTag: nextActiveTag,
        })
      },

      organizeMap: () => {
        lastTextEdit = null
        set((state) => ({
          nodes: applyDagreLayout(state.nodes, state.edges),
        }))
      },

      toggleInspector: () => {
        const next = !get().isInspectorOpen
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(INSPECTOR_STORAGE_KEY, String(next))
          }
        } catch {
          // ignore
        }
        set({ isInspectorOpen: next })
      },

      setInspectorOpen: (open: boolean) => {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(INSPECTOR_STORAGE_KEY, String(open))
          }
        } catch {
          // ignore
        }
        set({ isInspectorOpen: open })
      },

      undo: () => {
        lastTextEdit = null
        const state = get()
        if (state.focusId) {
          const focusedNode = state.nodes.find((n) => n.id === state.focusId)
          pendingUndoFocusFallbackId = focusedNode?.parentId || null
        } else {
          pendingUndoFocusFallbackId = null
        }
        useGraphStore.temporal.getState().undo()
      },

      redo: () => {
        lastTextEdit = null
        pendingUndoFocusFallbackId = null
        useGraphStore.temporal.getState().redo()
      },

      loadGraph: (graph) => {
        lastTextEdit = null
        const sanitized = sanitizeGraph(graph)
        set({
          nodes: sanitized.nodes,
          edges: sanitized.edges,
          selectedId: null,
          focusId: null,
          activeTag: null,
        })
      },

      resetGraph: () => {
        lastTextEdit = null
        pendingUndoFocusFallbackId = null
        set({
          nodes: [],
          edges: [],
          selectedId: null,
          focusId: null,
          activeTag: null,
          canUndo: false,
          canRedo: false,
        })
        useGraphStore.temporal.getState().clear()
      },

      importBatch: (newNodes, newEdges = []) => {
        lastTextEdit = null
        const state = get()
        const combined = sanitizeGraph({
          nodes: [...state.nodes, ...newNodes],
          edges: [...state.edges, ...newEdges],
        })
        const laidOutNodes = applyDagreLayout(combined.nodes, combined.edges)
        set({
          nodes: laidOutNodes,
          edges: combined.edges,
          focusId: null,
        })
      },
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      equality: (pastState, currentState) =>
        pastState.nodes === currentState.nodes && pastState.edges === currentState.edges,
      limit: 100,
    }
  )
)

// Sincroniza flags canUndo/canRedo e garante invariantes I6/I7 e filtro de tag após undo/redo
useGraphStore.temporal.subscribe((temporalState) => {
  const canUndo = temporalState.pastStates.length > 0
  const canRedo = temporalState.futureStates.length > 0
  const state = useGraphStore.getState()
  const validNodeIds = new Set(state.nodes.map((n) => n.id))
  const validEdgeIds = new Set(state.edges.map((e) => e.id))

  const nextSelectedId =
    state.selectedId &&
    (validNodeIds.has(state.selectedId) || validEdgeIds.has(state.selectedId))
      ? state.selectedId
      : null

  let nextFocusId = state.focusId
  if (state.focusId && !validNodeIds.has(state.focusId)) {
    nextFocusId =
      pendingUndoFocusFallbackId && validNodeIds.has(pendingUndoFocusFallbackId)
        ? pendingUndoFocusFallbackId
        : null
  }
  pendingUndoFocusFallbackId = null

  const nextActiveTag = resolveValidActiveTag(state.nodes, state.activeTag)

  if (
    state.canUndo !== canUndo ||
    state.canRedo !== canRedo ||
    state.selectedId !== nextSelectedId ||
    state.focusId !== nextFocusId ||
    state.activeTag !== nextActiveTag
  ) {
    useGraphStore.setState({
      canUndo,
      canRedo,
      selectedId: nextSelectedId,
      focusId: nextFocusId,
      activeTag: nextActiveTag,
    })
  }
})
