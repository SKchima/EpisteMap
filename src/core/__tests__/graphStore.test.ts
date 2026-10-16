import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphStore } from '../graphStore'

describe('Epistemap GraphStore (Spec-Driven Acceptance Tests)', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
  })

  it('deve inicializar com grafo vazio', () => {
    const state = useGraphStore.getState()
    expect(state.nodes).toHaveLength(0)
    expect(state.edges).toHaveLength(0)
    expect(state.selectedNodeId).toBeNull()
    expect(state.focusNodeId).toBeNull()
  })

  it('deve adicionar um nó raiz e selecioná-lo', () => {
    const store = useGraphStore.getState()
    const nodeId = store.addNode({
      position: { x: 100, y: 100 },
      data: {
        title: 'Física Clássica',
        description: 'Mecânica e Termodinâmica',
        tags: ['ciência', 'exatas'],
      },
    })

    const updatedState = useGraphStore.getState()
    expect(updatedState.nodes).toHaveLength(1)
    expect(updatedState.nodes[0].id).toBe(nodeId)
    expect(updatedState.nodes[0].data.title).toBe('Física Clássica')
    expect(updatedState.nodes[0].parentId).toBeUndefined()
  })

  it('deve adicionar um sub-objeto vinculado ao pai com parentId', () => {
    const store = useGraphStore.getState()
    const parentId = store.addNode({
      position: { x: 0, y: 0 },
      data: {
        title: 'Matemática',
        description: 'Fundamentos',
        tags: ['exatas'],
      },
    })

    const subNodeId = store.addSubNode(parentId, 'Álgebra Linear')

    const updatedState = useGraphStore.getState()
    expect(updatedState.nodes).toHaveLength(2)

    const subNode = updatedState.nodes.find((n) => n.id === subNodeId)
    expect(subNode).toBeDefined()
    expect(subNode?.parentId).toBe(parentId)
    expect(subNode?.data.parentId).toBe(parentId)
    expect(subNode?.data.title).toBe('Álgebra Linear')
    expect(subNode?.extent).toBe('parent')
  })

  it('deve alternar a expansão do nó pai', () => {
    const store = useGraphStore.getState()
    const parentId = store.addNode({
      position: { x: 0, y: 0 },
      data: {
        title: 'Biologia',
        description: 'Estudo da vida',
        tags: ['bio'],
        isExpanded: true,
      },
    })

    store.toggleNodeExpansion(parentId)
    expect(useGraphStore.getState().nodes.find((n) => n.id === parentId)?.data.isExpanded).toBe(false)

    store.toggleNodeExpansion(parentId)
    expect(useGraphStore.getState().nodes.find((n) => n.id === parentId)?.data.isExpanded).toBe(true)
  })

  it('deve remover nó em cascata: deletar o pai remove todos os sub-nós descendentes', () => {
    const store = useGraphStore.getState()
    const grandParentId = store.addNode({
      position: { x: 0, y: 0 },
      data: { title: 'Nível 1', description: '', tags: [] },
    })

    const parentId = store.addSubNode(grandParentId, 'Nível 2')
    store.addSubNode(parentId, 'Nível 3')

    expect(useGraphStore.getState().nodes).toHaveLength(3)

    // Deleta o avô -> deve deletar filho e neto
    useGraphStore.getState().removeNode(grandParentId)

    const remainingNodes = useGraphStore.getState().nodes
    expect(remainingNodes).toHaveLength(0)
  })

  it('deve remover arestas associadas quando um nó for deletado', () => {
    const store = useGraphStore.getState()
    const nodeA = store.addNode({
      position: { x: 0, y: 0 },
      data: { title: 'A', description: '', tags: [] },
    })
    const nodeB = store.addNode({
      position: { x: 200, y: 0 },
      data: { title: 'B', description: '', tags: [] },
    })

    store.addEdge({ source: nodeA, target: nodeB, label: 'influencia' })
    expect(useGraphStore.getState().edges).toHaveLength(1)

    store.removeNode(nodeA)
    expect(useGraphStore.getState().nodes).toHaveLength(1)
    expect(useGraphStore.getState().edges).toHaveLength(0)
  })

  it('deve resetar selectedNodeId e focusNodeId se o nó deletado estiver selecionado ou em foco', () => {
    const store = useGraphStore.getState()
    const nodeA = store.addNode({
      position: { x: 0, y: 0 },
      data: { title: 'A', description: '', tags: [] },
    })

    store.selectNode(nodeA)
    store.setFocusNode(nodeA)
    expect(useGraphStore.getState().selectedNodeId).toBe(nodeA)
    expect(useGraphStore.getState().focusNodeId).toBe(nodeA)

    store.removeNode(nodeA)
    expect(useGraphStore.getState().selectedNodeId).toBeNull()
    expect(useGraphStore.getState().focusNodeId).toBeNull()
  })

  it('deve gerar breadcrumbs hierárquicos corretos para drill-down', () => {
    const store = useGraphStore.getState()
    const level1 = store.addNode({
      position: { x: 0, y: 0 },
      data: { title: 'Ciência da Computação', description: '', tags: [] },
    })
    const level2 = store.addSubNode(level1, 'Algoritmos')
    const level3 = store.addSubNode(level2, 'Grafos')

    // Na raiz
    store.setFocusNode(null)
    const rootBreadcrumbs = store.getBreadcrumbs()
    expect(rootBreadcrumbs).toEqual([{ id: null, title: 'Visão Geral' }])

    // Em foco no level 3
    store.setFocusNode(level3)
    const focusedBreadcrumbs = store.getBreadcrumbs()
    expect(focusedBreadcrumbs).toHaveLength(4)
    expect(focusedBreadcrumbs[0]).toEqual({ id: null, title: 'Visão Geral' })
    expect(focusedBreadcrumbs[1]).toEqual({ id: level1, title: 'Ciência da Computação' })
    expect(focusedBreadcrumbs[2]).toEqual({ id: level2, title: 'Algoritmos' })
    expect(focusedBreadcrumbs[3]).toEqual({ id: level3, title: 'Grafos' })
  })

  it('deve atualizar metadados e descrição Markdown/LaTeX do nó', () => {
    const store = useGraphStore.getState()
    const nodeA = store.addNode({
      position: { x: 0, y: 0 },
      data: {
        title: 'Mecânica Quântica',
        description: 'Postulados iniciais',
        tags: ['física'],
      },
    })

    store.updateNodeData(nodeA, {
      description: 'Equação de Schrödinger: $i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle$',
      tags: ['física', 'quântica', 'avançada'],
    })

    const updatedNode = useGraphStore.getState().nodes.find((n) => n.id === nodeA)
    expect(updatedNode?.data.description).toContain('\\hat{H}|\\psi\\rangle')
    expect(updatedNode?.data.tags).toHaveLength(3)
  })
})
