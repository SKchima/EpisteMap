import type {
  KnowledgeNode,
  KnowledgeEdge,
  Graph,
  BreadcrumbItem,
  Position,
  BoundingBox,
  PdfAttachment,
} from './types'

export type SearchMatchCategory = 'title' | 'tag' | 'description'

export type SearchResult = {
  node: KnowledgeNode
  matchType: SearchMatchCategory
  path: string[]
}

export function isNodeInsideBoundingBox(
  pos: Position,
  containerRect: BoundingBox
): boolean {
  return (
    pos.x >= containerRect.x &&
    pos.x <= containerRect.x + containerRect.width &&
    pos.y >= containerRect.y &&
    pos.y <= containerRect.y + containerRect.height
  )
}

export function searchNodes(nodes: KnowledgeNode[], query: string): SearchResult[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function getAncestorTitles(nodeId: string): string[] {
    const ancestorIds = getAncestorIds(nodes, nodeId)
    return ancestorIds
      .reverse()
      .map((id) => nodeMap.get(id)?.data.title || '')
      .filter(Boolean)
  }

  const trimmed = query.trim()
  if (!trimmed) {
    return nodes.map((node) => ({
      node,
      matchType: 'title' as const,
      path: getAncestorTitles(node.id),
    }))
  }

  const q = trimmed.toLowerCase().replace(/^#/, '')
  const scored: { result: SearchResult; score: number }[] = []

  for (const node of nodes) {
    const titleMatch = node.data.title.toLowerCase().includes(q)
    const tagMatch = node.data.tags.some((t) => t.toLowerCase().includes(q))
    const descMatch = node.data.description.toLowerCase().includes(q)

    if (titleMatch) {
      scored.push({
        score: node.data.title.toLowerCase().startsWith(q) ? 4 : 3,
        result: { node, matchType: 'title', path: getAncestorTitles(node.id) },
      })
    } else if (tagMatch) {
      scored.push({
        score: 2,
        result: { node, matchType: 'tag', path: getAncestorTitles(node.id) },
      })
    } else if (descMatch) {
      scored.push({
        score: 1,
        result: { node, matchType: 'description', path: getAncestorTitles(node.id) },
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.result)
}

export function getSubtreeIds(nodes: KnowledgeNode[], rootId: string): Set<string> {
  const result = new Set<string>([rootId])
  let added = true
  while (added) {
    added = false
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id)
        added = true
      }
    }
  }
  return result
}

export function getAncestorIds(nodes: KnowledgeNode[], nodeId: string): string[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const ancestors: string[] = []
  let current = nodeMap.get(nodeId)
  const visited = new Set<string>()

  while (current && current.parentId) {
    if (visited.has(current.parentId)) break
    visited.add(current.parentId)
    ancestors.push(current.parentId)
    current = nodeMap.get(current.parentId)
  }
  return ancestors
}

export function getBreadcrumbs(nodes: KnowledgeNode[], focusId: string | null): BreadcrumbItem[] {
  const rootItem: BreadcrumbItem = { id: null, title: 'Visão geral' }
  if (!focusId) return [rootItem]

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const target = nodeMap.get(focusId)
  if (!target) return [rootItem]

  const chain: BreadcrumbItem[] = []
  let curr: KnowledgeNode | undefined = target
  const visited = new Set<string>()

  while (curr) {
    if (visited.has(curr.id)) break
    visited.add(curr.id)
    chain.unshift({ id: curr.id, title: curr.data.title })
    curr = curr.parentId ? nodeMap.get(curr.parentId) : undefined
  }

  return [rootItem, ...chain]
}

export function canReparent(
  nodes: KnowledgeNode[],
  nodeId: string,
  newParentId: string | null
): boolean {
  if (newParentId === null) return true
  if (nodeId === newParentId) return false

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  if (!nodeMap.has(newParentId)) return false

  const subtree = getSubtreeIds(nodes, nodeId)
  if (subtree.has(newParentId)) return false

  return true
}

export function resolveColor(nodes: KnowledgeNode[], nodeId: string): string | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  let current = nodeMap.get(nodeId)
  const visited = new Set<string>()

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    if (current.data.color) return current.data.color
    current = current.parentId ? nodeMap.get(current.parentId) : undefined
  }
  return null
}

export function extractWikiLinks(text: string): string[] {
  if (!text) return []
  const regex = /\[\[(.*?)\]\]/g
  const matches = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    const trimmed = m[1].trim()
    if (trimmed) matches.add(trimmed)
  }
  return Array.from(matches)
}

export function findNodeByTitle(nodes: KnowledgeNode[], title: string): KnowledgeNode | undefined {
  const normalized = title.trim().toLowerCase()
  return nodes.find((n) => n.data.title.trim().toLowerCase() === normalized)
}

export function getBacklinks(nodes: KnowledgeNode[], targetId: string): KnowledgeNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const target = nodeMap.get(targetId)
  if (!target) return []
  const targetTitle = target.data.title.trim().toLowerCase()

  return nodes.filter((n) => {
    if (n.id === targetId) return false
    const links = extractWikiLinks(n.data.description)
    return links.some((link) => link.toLowerCase() === targetTitle)
  })
}

export function sanitizeGraph(raw: unknown): Graph {
  if (!raw || typeof raw !== 'object' || !('nodes' in raw) || !Array.isArray((raw as { nodes: unknown }).nodes)) {
    throw new Error('Formato de grafo inválido: "nodes" deve ser um array.')
  }

  const rawObj = raw as { nodes: unknown[]; edges?: unknown[] }
  const rawNodes = rawObj.nodes
  const rawEdges = Array.isArray(rawObj.edges) ? rawObj.edges : []

  // 1. Filtrar nós válidos e desduplicar por ID
  const seenIds = new Set<string>()
  const parsedNodes: KnowledgeNode[] = []

  for (const item of rawNodes) {
    if (!item || typeof item !== 'object') continue
    const n = item as Record<string, unknown>
    if (typeof n.id !== 'string' || !n.id.trim()) continue
    const id = n.id.trim()
    if (seenIds.has(id)) continue
    seenIds.add(id)

    // Converter dados v1 se existirem
    const dataObj = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>
    const isExpanded = dataObj.isExpanded
    const collapsed =
      typeof dataObj.collapsed === 'boolean'
        ? dataObj.collapsed
        : typeof isExpanded === 'boolean'
          ? !isExpanded
          : false

    const pos =
      n.position && typeof n.position === 'object'
        ? {
            x: Number((n.position as Record<string, unknown>).x) || 0,
            y: Number((n.position as Record<string, unknown>).y) || 0,
          }
        : { x: 0, y: 0 }

    const tags = Array.isArray(dataObj.tags)
      ? dataObj.tags.filter((t): t is string => typeof t === 'string')
      : []

    const rawPdf = dataObj.pdfAttachment as Record<string, unknown> | undefined
    let pdfAttachment: PdfAttachment | null = null
    if (rawPdf && typeof rawPdf === 'object') {
      const rawName = typeof rawPdf.name === 'string' ? rawPdf.name.trim() : ''
      const rawBase64 = typeof rawPdf.base64 === 'string' ? rawPdf.base64 : ''
      const rawPage = Number(rawPdf.page)
      const rawFilePath =
        typeof rawPdf.filePath === 'string' && rawPdf.filePath.trim()
          ? rawPdf.filePath.trim()
          : undefined
      pdfAttachment = {
        name: rawName || 'documento.pdf',
        base64: rawBase64,
        page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
        ...(rawFilePath ? { filePath: rawFilePath } : {}),
      }
    }

    const nodeData: KnowledgeNode['data'] = {
      title: typeof dataObj.title === 'string' && dataObj.title.trim() ? dataObj.title.trim() : 'Sem título',
      description: typeof dataObj.description === 'string' ? dataObj.description : '',
      tags,
      color: typeof dataObj.color === 'string' && dataObj.color.trim() ? dataObj.color.trim() : null,
      collapsed,
    }
    if (pdfAttachment) {
      nodeData.pdfAttachment = pdfAttachment
    }

    parsedNodes.push({
      id,
      parentId: typeof n.parentId === 'string' && n.parentId.trim() ? n.parentId.trim() : null,
      position: pos,
      data: nodeData,
    })
  }

  // 2. Corrigir parentId inexistente
  for (const node of parsedNodes) {
    if (node.parentId && !seenIds.has(node.parentId)) {
      node.parentId = null
    }
  }

  // 3. Desfazer ciclos na hierarquia
  for (const node of parsedNodes) {
    if (!node.parentId) continue
    const ancestors = getAncestorIds(parsedNodes, node.id)
    if (ancestors.includes(node.id)) {
      node.parentId = null
    }
  }

  // 4. Ordenar nós topologicamente (pais antes dos filhos)
  const sortedNodes: KnowledgeNode[] = []
  const nodeMap = new Map(parsedNodes.map((n) => [n.id, n]))
  const addedIds = new Set<string>()

  function addNodeAndDescendants(n: KnowledgeNode) {
    if (addedIds.has(n.id)) return
    // Adiciona ancestrais primeiro se ainda não adicionados
    if (n.parentId && !addedIds.has(n.parentId)) {
      const parent = nodeMap.get(n.parentId)
      if (parent) addNodeAndDescendants(parent)
    }
    addedIds.add(n.id)
    sortedNodes.push(n)

    // Adiciona filhos imediatos
    for (const child of parsedNodes) {
      if (child.parentId === n.id) {
        addNodeAndDescendants(child)
      }
    }
  }

  for (const n of parsedNodes) {
    if (n.parentId === null) {
      addNodeAndDescendants(n)
    }
  }
  // Caso tenha sobrado algum nó órfão desconectado
  for (const n of parsedNodes) {
    if (!addedIds.has(n.id)) {
      addNodeAndDescendants(n)
    }
  }

  // 5. Validar e desduplicar arestas
  const finalEdges: KnowledgeEdge[] = []
  const seenEdgePairs = new Set<string>()

  for (const item of rawEdges) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    if (typeof e.source !== 'string' || typeof e.target !== 'string') continue
    const source = e.source.trim()
    const target = e.target.trim()
    if (!seenIds.has(source) || !seenIds.has(target)) continue
    if (source === target) continue

    const pairKey = `${source}->${target}`
    if (seenEdgePairs.has(pairKey)) continue
    seenEdgePairs.add(pairKey)

    const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : `edge_${Math.random().toString(36).slice(2, 9)}`
    const label = typeof e.label === 'string' ? e.label : ''

    finalEdges.push({ id, source, target, label })
  }

  return {
    nodes: sortedNodes,
    edges: finalEdges,
  }
}
