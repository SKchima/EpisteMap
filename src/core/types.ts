/**
 * Modelo de domínio e Store do Epistemap (specs/DOMAIN_SPEC.md v2).
 */

export type Position = { x: number; y: number }

export type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

export type ThemeMode = 'dark' | 'light' | 'high-contrast'

export type ZoomLodLevel = 'macro' | 'standard' | 'micro'

export type ChildNodeSummary = {
  id: string
  title: string
  color: string | null
}

export type PdfAttachment = {
  name: string
  base64: string
  page: number
  /** Caminho absoluto opcional no disco local (evita duplicar payload base64 para compêndios locais). */
  filePath?: string
}

export type NodeData = {
  title: string
  description: string
  tags: string[]
  /** Cor de destaque; quando null, herda a do ancestral mais próximo. */
  color: string | null
  collapsed: boolean
  pdfAttachment?: PdfAttachment | null
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

export type EditorMode = 'edit' | 'view'

export interface EpistemapStore {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  selectedId: string | null
  focusId: string | null
  activeTag: string | null
  theme: ThemeMode
  canUndo: boolean
  canRedo: boolean

  // Ações de Nó
  addRootNode: (title?: string, position?: Position) => string
  addSubNode: (parentId: string, title?: string) => string
  updateNode: (id: string, partial: Partial<NodeData>) => void
  updateRootPosition: (id: string, position: Position) => void
  removeNode: (id: string) => void
  reparentNode: (id: string, newParentId: string | null, position?: Position) => boolean
  toggleCollapse: (id: string) => void
  createNodeFromWikiLink: (sourceNodeId: string, targetTitle: string) => string

  // Acoplamento de PDF
  attachPdf: (nodeId: string, attachment: PdfAttachment) => void
  removePdf: (nodeId: string) => void
  setPdfPage: (nodeId: string, page: number) => void

  // Ações de Aresta
  addEdge: (source: string, target: string, label?: string) => string
  updateEdgeLabel: (edgeId: string, label: string) => void
  removeEdge: (edgeId: string) => void

  // Navegação, Busca, Tema, Modo e Layout
  select: (id: string | null) => void
  setFocus: (id: string | null) => void
  setActiveTag: (tag: string | null) => void
  setTheme: (theme: ThemeMode) => void
  navigateToNode: (nodeId: string) => void
  organizeMap: () => void
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  toggleEditorMode: () => void
  isInspectorOpen: boolean
  toggleInspector: () => void
  setInspectorOpen: (open: boolean) => void

  // Histórico (Undo/Redo via Zundo)
  undo: () => void
  redo: () => void

  // Persistência e Importação em Lote
  loadGraph: (graph: Graph) => void
  resetGraph: () => void
  importBatch: (newNodes: KnowledgeNode[], newEdges?: KnowledgeEdge[]) => void
}
