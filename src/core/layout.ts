import dagre from '@dagrejs/dagre'
import { MarkerType, type Node as RFNode, type Edge as RFEdge } from '@xyflow/react'
import type { KnowledgeNode, KnowledgeEdge, Position, BoundingBox, ChildNodeSummary } from './types'
import { getAncestorIds, getSubtreeIds, resolveColor, canReparent, isNodeInsideBoundingBox } from './graph'

export const LEAF_WIDTH = 232
export const LEAF_HEIGHT = 112
export const HEADER_HEIGHT = 44
export const PADDING = 16
export const GAP = 16

export type NodeSize = { width: number; height: number }

export function computeNodeSizes(
  nodes: KnowledgeNode[],
  focusId: string | null = null
): Map<string, NodeSize> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const sizeMap = new Map<string, NodeSize>()

  function calculateSize(nodeId: string, visited: Set<string> = new Set()): NodeSize {
    if (sizeMap.has(nodeId)) return sizeMap.get(nodeId)!
    if (visited.has(nodeId)) return { width: LEAF_WIDTH, height: LEAF_HEIGHT }
    visited.add(nodeId)

    const node = nodeMap.get(nodeId)
    if (!node) return { width: LEAF_WIDTH, height: LEAF_HEIGHT }

    const children = nodes.filter((n) => n.parentId === nodeId)
    const isNodeCollapsed = nodeId === focusId ? false : Boolean(node.data.collapsed)
    if (children.length === 0 || isNodeCollapsed) {
      const leaf = { width: LEAF_WIDTH, height: LEAF_HEIGHT }
      sizeMap.set(nodeId, leaf)
      return leaf
    }

    const childSizes = children.map((c) => calculateSize(c.id, new Set(visited)))
    const k = children.length
    const cols = Math.min(k, Math.max(1, Math.ceil(Math.sqrt(k))))
    const rows = Math.ceil(k / cols)

    const colWidths = new Array<number>(cols).fill(0)
    const rowHeights = new Array<number>(rows).fill(0)

    children.forEach((_c, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const cs = childSizes[index]
      colWidths[col] = Math.max(colWidths[col], cs.width)
      rowHeights[row] = Math.max(rowHeights[row], cs.height)
    })

    const totalW =
      PADDING * 2 +
      colWidths.reduce((sum, w) => sum + w, 0) +
      Math.max(0, cols - 1) * GAP
    const totalH =
      HEADER_HEIGHT +
      PADDING * 2 +
      rowHeights.reduce((sum, h) => sum + h, 0) +
      Math.max(0, rows - 1) * GAP

    const containerSize = {
      width: Math.max(LEAF_WIDTH, totalW),
      height: Math.max(LEAF_HEIGHT, totalH),
    }

    sizeMap.set(nodeId, containerSize)
    return containerSize
  }

  for (const n of nodes) {
    calculateSize(n.id)
  }

  return sizeMap
}

export type BuildFlowOptions = {
  focusId: string | null
  selectedId: string | null
  dropTargetId?: string | null
  activeTag?: string | null
}

export function buildFlowElements(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  options: BuildFlowOptions
): { flowNodes: RFNode[]; flowEdges: RFEdge[] } {
  const { focusId, selectedId, dropTargetId = null, activeTag = null } = options
  const sizes = computeNodeSizes(nodes, focusId)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // 1. Identificar nós visíveis
  let visibleNodes: KnowledgeNode[] = []

  if (focusId === null) {
    // Modo geral: Raízes visíveis; filhos visíveis apenas se todos os ancestrais estiverem expandidos (!collapsed)
    function isNodeVisible(n: KnowledgeNode): boolean {
      if (!n.parentId) return true
      let parent = nodeMap.get(n.parentId)
      while (parent) {
        if (parent.data.collapsed) return false
        parent = parent.parentId ? nodeMap.get(parent.parentId) : undefined
      }
      return true
    }
    visibleNodes = nodes.filter(isNodeVisible)
  } else {
    // Modo drill-down focado
    const focused = nodeMap.get(focusId)
    if (focused) {
      const allowed = new Set<string>([focusId])
      let added = true
      while (added) {
        added = false
        for (const n of nodes) {
          if (n.parentId && allowed.has(n.parentId) && !allowed.has(n.id)) {
            const parent = nodeMap.get(n.parentId)
            if (parent && (parent.id === focusId || !parent.data.collapsed)) {
              allowed.add(n.id)
              added = true
            }
          }
        }
      }
      visibleNodes = nodes.filter((n) => allowed.has(n.id))
    }
  }

  const visibleIdSet = new Set(visibleNodes.map((n) => n.id))

  // 2. Ordenação topológica (pais DEVEM vir antes dos filhos para o React Flow)
  const orderedNodes: KnowledgeNode[] = []
  const addedIds = new Set<string>()

  function addNodeHierarchy(n: KnowledgeNode) {
    if (addedIds.has(n.id)) return
    if (n.parentId && visibleIdSet.has(n.parentId) && !addedIds.has(n.parentId)) {
      const parent = nodeMap.get(n.parentId)
      if (parent) addNodeHierarchy(parent)
    }
    addedIds.add(n.id)
    orderedNodes.push(n)

    const children = visibleNodes.filter((c) => c.parentId === n.id)
    for (const c of children) {
      addNodeHierarchy(c)
    }
  }

  for (const n of visibleNodes) {
    if (n.id === focusId || !n.parentId || !visibleIdSet.has(n.parentId)) {
      addNodeHierarchy(n)
    }
  }

  // 3. Montar posições e elementos do React Flow
  const flowNodes: RFNode[] = []

  // Mapeia posições relativas dos filhos dentro de cada contêiner
  const childPositions = new Map<string, Position>()

  for (const parent of orderedNodes) {
    const children = visibleNodes.filter((c) => c.parentId === parent.id)
    const isParentCollapsed = parent.id === focusId ? false : Boolean(parent.data.collapsed)
    if (children.length === 0 || isParentCollapsed) continue

    const k = children.length
    const cols = Math.min(k, Math.max(1, Math.ceil(Math.sqrt(k))))
    const rows = Math.ceil(k / cols)

    const colWidths = new Array<number>(cols).fill(0)
    const rowHeights = new Array<number>(rows).fill(0)

    children.forEach((c, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const cs = sizes.get(c.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }
      colWidths[col] = Math.max(colWidths[col], cs.width)
      rowHeights[row] = Math.max(rowHeights[row], cs.height)
    })

    const colOffsets: number[] = [PADDING]
    for (let c = 0; c < cols - 1; c++) {
      colOffsets.push(colOffsets[c] + colWidths[c] + GAP)
    }

    const rowOffsets: number[] = [HEADER_HEIGHT + PADDING]
    for (let r = 0; r < rows - 1; r++) {
      rowOffsets.push(rowOffsets[r] + rowHeights[r] + GAP)
    }

    children.forEach((c, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      childPositions.set(c.id, { x: colOffsets[col], y: rowOffsets[row] })
    })
  }

  for (const n of orderedNodes) {
    const size = sizes.get(n.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }
    const isDrillRoot = focusId !== null && n.id === focusId
    const isRoot = isDrillRoot || !n.parentId || !visibleIdSet.has(n.parentId)
    const isNodeCollapsed = isDrillRoot ? false : Boolean(n.data.collapsed)

    let pos: Position = { x: 0, y: 0 }
    let parentIdProp: string | undefined = undefined

    if (isDrillRoot) {
      pos = { x: 0, y: 0 }
      parentIdProp = undefined
    } else if (isRoot) {
      pos = n.position
      parentIdProp = undefined
    } else {
      pos = childPositions.get(n.id) || { x: PADDING, y: HEADER_HEIGHT + PADDING }
      parentIdProp = n.parentId!
    }

    const directChildren = nodes.filter((c) => c.parentId === n.id)
    const childrenCount = directChildren.length
    const childrenSummary: ChildNodeSummary[] = directChildren.map((c) => ({
      id: c.id,
      title: c.data.title,
      color: resolveColor(nodes, c.id),
    }))
    const color = resolveColor(nodes, n.id)

    let isDimmed = false
    if (activeTag) {
      const subtreeIds = getSubtreeIds(nodes, n.id)
      const hasTagInSubtree = nodes.some(
        (cand) => subtreeIds.has(cand.id) && cand.data.tags.includes(activeTag)
      )
      isDimmed = !hasTagInSubtree
    }

    flowNodes.push({
      id: n.id,
      type: 'compound',
      position: pos,
      width: size.width,
      height: size.height,
      parentId: parentIdProp,
      selected: n.id === selectedId,
      style: {
        width: size.width,
        height: size.height,
      },
      data: {
        title: n.data.title,
        description: n.data.description,
        tags: n.data.tags,
        collapsed: isNodeCollapsed,
        color,
        childCount: childrenCount,
        childrenSummary,
        isContainer: childrenCount > 0 && !isNodeCollapsed,
        isDropTarget: dropTargetId === n.id,
        isDimmed,
        pdfAttachment: n.data.pdfAttachment,
        width: size.width,
        height: size.height,
      },
    })
  }

  // 4. Arestas: elevação para o nó visível mais próximo
  function getVisibleTarget(id: string): string | null {
    if (visibleIdSet.has(id)) return id
    const ancestors = getAncestorIds(nodes, id)
    for (const ancId of ancestors) {
      if (visibleIdSet.has(ancId)) return ancId
    }
    return null
  }

  const flowEdges: RFEdge[] = []
  const edgeDedupe = new Set<string>()

  for (const edge of edges) {
    const sourceVis = getVisibleTarget(edge.source)
    const targetVis = getVisibleTarget(edge.target)

    if (!sourceVis || !targetVis) continue
    if (sourceVis === targetVis) continue // Self-loop gerado por nó recolhido

    const key = `${sourceVis}->${targetVis}`
    if (edgeDedupe.has(key)) continue
    edgeDedupe.add(key)

    const isElevated = sourceVis !== edge.source || targetVis !== edge.target
    const isEdgeSelected = edge.id === selectedId
    const strokeColor = isEdgeSelected ? '#38bdf8' : isElevated ? '#64748b' : '#6366f1'

    flowEdges.push({
      id: edge.id,
      source: sourceVis,
      target: targetVis,
      label: edge.label,
      selected: isEdgeSelected,
      animated: isElevated,
      labelStyle: {
        fill: '#e2e8f0',
        fontSize: 11,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: '#151822',
        stroke: isEdgeSelected ? '#38bdf8' : '#2d3448',
        strokeWidth: 1,
      },
      labelBgPadding: [4, 6],
      labelBgBorderRadius: 4,
      style: {
        stroke: strokeColor,
        strokeWidth: isEdgeSelected ? 3 : 2,
        strokeDasharray: isElevated ? '5,5' : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 16,
        height: 16,
      },
    })
  }

  return { flowNodes, flowEdges }
}

export function computeNodeBoundingBoxes(flowNodes: RFNode[]): Map<string, BoundingBox> {
  const boxes = new Map<string, BoundingBox>()
  for (const fn of flowNodes) {
    const parentBox = fn.parentId ? boxes.get(fn.parentId) : undefined
    const absX = (parentBox?.x || 0) + fn.position.x
    const absY = (parentBox?.y || 0) + fn.position.y
    const data = (fn.data || {}) as { width?: number; height?: number }
    const width = data.width || fn.width || LEAF_WIDTH
    const height = data.height || fn.height || LEAF_HEIGHT
    boxes.set(fn.id, { x: absX, y: absY, width, height })
  }
  return boxes
}

export function findDropTargetNodeId(
  nodes: KnowledgeNode[],
  flowNodes: RFNode[],
  draggedId: string,
  dropPoint: Position
): string | null {
  const boxes = computeNodeBoundingBoxes(flowNodes)
  let bestTargetId: string | null = null
  let smallestArea = Infinity

  for (const fn of flowNodes) {
    if (fn.id === draggedId) continue
    if (!canReparent(nodes, draggedId, fn.id)) continue
    const box = boxes.get(fn.id)
    if (!box) continue
    if (isNodeInsideBoundingBox(dropPoint, box)) {
      const area = box.width * box.height
      if (area < smallestArea) {
        smallestArea = area
        bestTargetId = fn.id
      }
    }
  }

  return bestTargetId
}

export function findFreePosition(
  existingNodes: KnowledgeNode[],
  startPos: Position,
  width: number = LEAF_WIDTH,
  height: number = LEAF_HEIGHT
): Position {
  const roots = existingNodes.filter((n) => n.parentId === null)
  if (roots.length === 0) return startPos

  const sizes = computeNodeSizes(existingNodes)
  const MARGIN = 40

  function isOverlapping(x: number, y: number): boolean {
    const r1 = { left: x, right: x + width, top: y, bottom: y + height }
    for (const r of roots) {
      const rs = sizes.get(r.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }
      const r2 = {
        left: r.position.x - MARGIN,
        right: r.position.x + rs.width + MARGIN,
        top: r.position.y - MARGIN,
        bottom: r.position.y + rs.height + MARGIN,
      }
      if (!(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom)) {
        return true
      }
    }
    return false
  }

  if (!isOverlapping(startPos.x, startPos.y)) {
    return startPos
  }

  // Busca em espiral ao redor de startPos
  const STEP = 50
  for (let radius = 1; radius <= 20; radius++) {
    const d = radius * STEP
    const candidates: Position[] = [
      { x: startPos.x + d, y: startPos.y },
      { x: startPos.x, y: startPos.y + d },
      { x: startPos.x + d, y: startPos.y + d },
      { x: startPos.x - d, y: startPos.y },
      { x: startPos.x, y: startPos.y - d },
      { x: startPos.x - d, y: startPos.y - d },
      { x: startPos.x + d, y: startPos.y - d },
      { x: startPos.x - d, y: startPos.y + d },
    ]

    for (const cand of candidates) {
      if (!isOverlapping(cand.x, cand.y)) {
        return cand
      }
    }
  }

  return { x: startPos.x + 300, y: startPos.y }
}

export function applyDagreLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[]
): KnowledgeNode[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'LR',
    nodesep: 80,
    ranksep: 120,
    marginx: 50,
    marginy: 50,
  })
  g.setDefaultEdgeLabel(() => ({}))

  const sizes = computeNodeSizes(nodes)
  const roots = nodes.filter((n) => n.parentId === null)
  if (roots.length === 0) return nodes

  const rootIdSet = new Set(roots.map((r) => r.id))

  // Mapeia qualquer nó para sua raiz
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  function getRootId(id: string): string {
    let curr = nodeMap.get(id)
    while (curr && curr.parentId) {
      curr = nodeMap.get(curr.parentId)
    }
    return curr ? curr.id : id
  }

  // Adiciona nós raízes ao dagre
  for (const root of roots) {
    const size = sizes.get(root.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }
    g.setNode(root.id, { width: size.width, height: size.height })
  }

  // Adiciona arestas elevadas às raízes
  const addedEdges = new Set<string>()
  for (const e of edges) {
    const srcRoot = getRootId(e.source)
    const tgtRoot = getRootId(e.target)
    if (rootIdSet.has(srcRoot) && rootIdSet.has(tgtRoot) && srcRoot !== tgtRoot) {
      const key = `${srcRoot}->${tgtRoot}`
      if (!addedEdges.has(key)) {
        addedEdges.add(key)
        g.setEdge(srcRoot, tgtRoot)
      }
    }
  }

  // Se não houver arestas conectando as raízes (ex: compêndios independentes),
  // organiza em grid equilibrado de 2 colunas para telas widescreen em vez de empilhar tudo numa única coluna vertical
  if (addedEdges.size === 0 && roots.length > 1) {
    const GAP_X = 120
    const GAP_Y = 100
    const START_X = 80
    const START_Y = 80

    let y0 = START_Y
    let y1 = START_Y

    let maxCol0Width = 0
    roots.forEach((r, idx) => {
      if (idx % 2 === 0) {
        const s = sizes.get(r.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }
        maxCol0Width = Math.max(maxCol0Width, s.width)
      }
    })

    const rootPositions = new Map<string, Position>()
    roots.forEach((r, idx) => {
      const isCol1 = idx % 2 === 1
      const x = isCol1 ? START_X + maxCol0Width + GAP_X : START_X
      const y = isCol1 ? y1 : y0
      const s = sizes.get(r.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }

      rootPositions.set(r.id, { x, y })
      if (isCol1) {
        y1 += s.height + GAP_Y
      } else {
        y0 += s.height + GAP_Y
      }
    })

    return nodes.map((node) => {
      if (node.parentId !== null) return node
      const pos = rootPositions.get(node.id)
      return pos ? { ...node, position: pos } : node
    })
  }

  dagre.layout(g)

  // Atualiza as posições das raízes
  return nodes.map((node) => {
    if (node.parentId !== null) return node
    const dagreNode = g.node(node.id)
    if (!dagreNode) return node
    const size = sizes.get(node.id) || { width: LEAF_WIDTH, height: LEAF_HEIGHT }
    return {
      ...node,
      position: {
        x: Math.round(dagreNode.x - size.width / 2),
        y: Math.round(dagreNode.y - size.height / 2),
      },
    }
  })
}
