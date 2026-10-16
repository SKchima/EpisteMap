# Especificação de Contrato: Core de Domínio do Grafo (Fase 1)

Esta especificação define o modelo de dados, operações de domínio, invariantes matemáticas e casos de borda para o motor de conhecimento do **Epistemap**.

---

## 1. Contrato de Interfaces e Tipos

```typescript
export interface EpistemeNodeData {
  title: string;
  description: string; // Markdown com KaTeX
  tags: string[];
  parentId?: string | null; // ID do nó pai, se for sub-objeto
  isExpanded?: boolean;     // Se os nós filhos imediatos estão expandidos visualmente
  color?: string;           // Cor temática sóbria para diferenciação de áreas
}

export interface EpistemeNode {
  id: string;
  type?: string;            // 'default' | 'compound' | 'subnode'
  position: { x: number; y: number };
  data: EpistemeNodeData;
  parentId?: string;        // Propriedade do React Flow para nós aninhados
  extent?: 'parent' | undefined;
}

export interface EpistemeEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface BreadcrumbItem {
  id: string | null;        // null representa a raiz do mapa mental
  title: string;
}

export interface EpistemapState {
  nodes: EpistemeNode[];
  edges: EpistemeEdge[];
  selectedNodeId: string | null;
  focusNodeId: string | null; // null = exibição global; string = modo drill-down focado no nó
  
  // Ações do Grafo
  addNode: (node: Omit<EpistemeNode, 'id'> & { id?: string }) => string;
  addSubNode: (parentId: string, title?: string) => string;
  updateNodeData: (id: string, partialData: Partial<EpistemeNodeData>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  toggleNodeExpansion: (id: string) => void;
  
  // Arestas
  addEdge: (edge: Omit<EpistemeEdge, 'id'> & { id?: string }) => void;
  removeEdge: (edgeId: string) => void;
  
  // Foco e Navegação
  selectNode: (id: string | null) => void;
  setFocusNode: (id: string | null) => void;
  getBreadcrumbs: () => BreadcrumbItem[];
  getVisibleElements: () => { nodes: EpistemeNode[]; edges: EpistemeEdge[] };
  
  // Serialização / Reset
  loadGraph: (nodes: EpistemeNode[], edges: EpistemeEdge[]) => void;
  resetGraph: () => void;
}
```

---

## 2. Invariantes e Regras de Negócio

1. **Unicidade de Identificadores**: Todo nó e aresta possui um identificador `id` único no grafo.
2. **Prevenção de Ciclos na Hierarquia**:
   - Um nó $A$ nunca pode se tornar sub-objeto de si mesmo ($A \to A$).
   - Um nó $A$ nunca pode ter como pai um de seus descendentes ($A \to B \to \dots \to A$).
3. **Deleção em Cascata de Sub-objetos**:
   - Deletar um nó $P$ deve remover automaticamente todos os nós filhos transitivos ($C_1, C_2, \dots$) cuja árvore de ascendência dependa exclusivamente de $P$.
   - Todas as arestas conectadas aos nós removidos devem ser purgadas para manter integridade referencial.
4. **Relacionamento com React Flow**:
   - Quando um nó possui `parentId`, sua coordenada `position` é tratada como relativa ao seu container pai.
5. **Comportamento de Drill-Down**:
   - Quando `focusNodeId === null`, a visão global renderiza os nós raiz (e nós filhos cujo pai está com `isExpanded: true`).
   - Quando `focusNodeId === "node-X"`, o canvas renderiza exclusivamente o nó $X$ e seus descendentes/arestas correspondentes.
   - A trilha de `breadcrumbs` deve refletir a cadeia de ancestrais exata desde a raiz até o nó em foco: `[ { id: null, title: 'Raiz' }, ..., { id: 'node-X', title: '...' } ]`.

---

## 3. Casos Limite (Edge Cases)

1. **Grafo Vazio**: Adicionar nós em um grafo vazio deve funcionar sem erros; breadcrumbs devem apontar para a raiz.
2. **Remoção de Nó Selecionado ou em Foco**:
   - Se o nó selecionado for removido, `selectedNodeId` deve ser redefinido para `null`.
   - Se o nó em foco (drill-down) for removido, `focusNodeId` deve recuar para o pai do nó removido ou para a raiz (`null`).
3. **Tentativa de Inserir Sub-nó em Nó Inexistente**: Dispara erro previsível ou retorna nulo sem corromper o estado existente.
4. **Subdivisão Múltipla**: Um objeto pode ser subdividido em 10+ sub-objetos com posicionamento inicial não sobreposto.
