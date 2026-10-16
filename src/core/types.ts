/**
 * Modelo de domínio e Store do Epistemap (specs/DOMAIN_SPEC.md v2).
 */

export type Position = { x: number; y: number }

export type NodeData = {
  title: string
  description: string
  tags: string[]
  /** Cor de destaque; quando null, herda a do ancestral mais próximo. */
  color: string | null
  collapsed: boolean
}

export type KnowledgeNode = {
  id: string
  /** null = conceito raiz. */
  parentId: string | null
  /** Só tem significado para raízes; a posição de sub-objetos é derivada pelo layout. */
  position: Position
  data: NodeData
}

export type KnowledgeEdge = {
  id: string
  source: string
  target: string
  label: string
}

export type Graph = {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export type BreadcrumbItem = {
  id: string | null
  title: string
}

export interface EpistemapStore {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  selectedId: string | null
  focusId: string | null

  // Ações de Nó
  addRootNode: (title?: string, position?: Position) => string
  addSubNode: (parentId: string, title?: string) => string
  updateNode: (id: string, partial: Partial<NodeData>) => void
  updateRootPosition: (id: string, position: Position) => void
  removeNode: (id: string) => void
  reparentNode: (id: string, newParentId: string | null) => boolean
  toggleCollapse: (id: string) => void

  // Ações de Aresta
  addEdge: (source: string, target: string, label?: string) => string
  removeEdge: (edgeId: string) => void

  // Navegação e Layout
  select: (id: string | null) => void
  setFocus: (id: string | null) => void
  organizeMap: () => void

  // Persistência
  loadGraph: (graph: Graph) => void
  resetGraph: () => void
}
