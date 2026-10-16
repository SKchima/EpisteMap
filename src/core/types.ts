import type { NodeChange, EdgeChange, Connection } from '@xyflow/react'

export interface EpistemeNodeData {
  title: string;
  description: string;
  tags: string[];
  parentId?: string | null;
  isExpanded?: boolean;
  color?: string;
  [key: string]: unknown;
}

export interface EpistemeNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: EpistemeNodeData;
  parentId?: string;
  extent?: 'parent' | undefined;
  [key: string]: unknown;
}

export interface EpistemeEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  [key: string]: unknown;
}

export interface BreadcrumbItem {
  id: string | null;
  title: string;
}

export interface EpistemapState {
  nodes: EpistemeNode[];
  edges: EpistemeEdge[];
  selectedNodeId: string | null;
  focusNodeId: string | null;

  // Reatividade do React Flow
  onNodesChange: (changes: NodeChange<EpistemeNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<EpistemeEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  // Operações de Nó
  addNode: (node: {
    position: { x: number; y: number };
    data?: Partial<EpistemeNodeData>;
    type?: string;
    id?: string;
    parentId?: string;
    extent?: 'parent';
  }) => string;
  addSubNode: (parentId: string, title?: string) => string;
  updateNodeData: (id: string, partialData: Partial<EpistemeNodeData>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  toggleNodeExpansion: (id: string) => void;

  // Operações de Aresta
  addEdge: (edge: {
    source: string;
    target: string;
    label?: string;
    animated?: boolean;
    id?: string;
  }) => void;
  removeEdge: (edgeId: string) => void;

  // Foco e Navegação
  selectNode: (id: string | null) => void;
  setFocusNode: (id: string | null) => void;
  getBreadcrumbs: () => BreadcrumbItem[];
  getVisibleElements: () => { nodes: EpistemeNode[]; edges: EpistemeEdge[] };

  // Utilitários de Persistência
  loadGraph: (nodes: EpistemeNode[], edges: EpistemeEdge[]) => void;
  resetGraph: () => void;
}
