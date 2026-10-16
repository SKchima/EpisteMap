import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphStore } from '../graphStore'

describe('Epistemap GraphStore (Spec-Driven Acceptance Tests v2)', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
  })

  it('deve inicializar com grafo vazio', () => {
    const state = useGraphStore.getState()
    expect(state.nodes).toHaveLength(0)
    expect(state.edges).toHaveLength(0)
    expect(state.selectedId).toBeNull()
    expect(state.focusId).toBeNull()
  })

  it('deve adicionar um nó raiz e selecioná-lo', () => {
    const store = useGraphStore.getState()
    const nodeId = store.addRootNode('Física Clássica', { x: 100, y: 100 })

    const updatedState = useGraphStore.getState()
    expect(updatedState.nodes).toHaveLength(1)
    expect(updatedState.nodes[0].id).toBe(nodeId)
    expect(updatedState.nodes[0].data.title).toBe('Física Clássica')
    expect(updatedState.nodes[0].parentId).toBeNull()
    expect(updatedState.selectedId).toBe(nodeId)
  })

  it('deve adicionar um sub-objeto vinculado ao pai com parentId', () => {
    const store = useGraphStore.getState()
    const parentId = store.addRootNode('Matemática')
    const subNodeId = store.addSubNode(parentId, 'Álgebra Linear')

    const updatedState = useGraphStore.getState()
    expect(updatedState.nodes).toHaveLength(2)

    const subNode = updatedState.nodes.find((n) => n.id === subNodeId)
    expect(subNode).toBeDefined()
    expect(subNode?.parentId).toBe(parentId)
    expect(subNode?.data.title).toBe('Álgebra Linear')
    expect(updatedState.selectedId).toBe(subNodeId)
  })

  it('deve alternar o recolhimento (collapsed) do nó', () => {
    const store = useGraphStore.getState()
    const parentId = store.addRootNode('Biologia')

    expect(useGraphStore.getState().nodes.find((n) => n.id === parentId)?.data.collapsed).toBe(false)
    store.toggleCollapse(parentId)
    expect(useGraphStore.getState().nodes.find((n) => n.id === parentId)?.data.collapsed).toBe(true)
    store.toggleCollapse(parentId)
    expect(useGraphStore.getState().nodes.find((n) => n.id === parentId)?.data.collapsed).toBe(false)
  })

  it('deve remover nó em cascata: deletar o pai remove todos os sub-nós descendentes', () => {
    const store = useGraphStore.getState()
    const grandParentId = store.addRootNode('Nível 1')
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
    const nodeA = store.addRootNode('A')
    const nodeB = store.addRootNode('B')

    store.addEdge(nodeA, nodeB, 'influencia')
    expect(useGraphStore.getState().edges).toHaveLength(1)

    store.removeNode(nodeA)
    expect(useGraphStore.getState().nodes).toHaveLength(1)
    expect(useGraphStore.getState().edges).toHaveLength(0)
  })

  it('deve resetar selectedId e focusId se o nó deletado estiver selecionado ou em foco', () => {
    const store = useGraphStore.getState()
    const nodeA = store.addRootNode('A')

    store.select(nodeA)
    store.setFocus(nodeA)
    expect(useGraphStore.getState().selectedId).toBe(nodeA)
    expect(useGraphStore.getState().focusId).toBe(nodeA)

    store.removeNode(nodeA)
    expect(useGraphStore.getState().selectedId).toBeNull()
    expect(useGraphStore.getState().focusId).toBeNull()
  })

  it('deve permitir reparenting válido e impedir ciclos (I3 e I8)', () => {
    const store = useGraphStore.getState()
    const nodeA = store.addRootNode('A')
    const nodeB = store.addSubNode(nodeA, 'B')
    const nodeC = store.addSubNode(nodeB, 'C')
    const nodeD = store.addRootNode('D')

    // Tentar tornar A filho de seu próprio descendente C deve ser rejeitado
    const cyclicAttempt = store.reparentNode(nodeA, nodeC)
    expect(cyclicAttempt).toBe(false)
    expect(useGraphStore.getState().nodes.find((n) => n.id === nodeA)?.parentId).toBeNull()

    // Tentar tornar A filho de si mesmo deve ser rejeitado
    const selfAttempt = store.reparentNode(nodeA, nodeA)
    expect(selfAttempt).toBe(false)

    // Mover C para ser filho de D é válido
    const validMove = store.reparentNode(nodeC, nodeD)
    expect(validMove).toBe(true)
    expect(useGraphStore.getState().nodes.find((n) => n.id === nodeC)?.parentId).toBe(nodeD)

    // Promover B a raiz é válido
    const promoteRoot = store.reparentNode(nodeB, null)
    expect(promoteRoot).toBe(true)
    expect(useGraphStore.getState().nodes.find((n) => n.id === nodeB)?.parentId).toBeNull()
  })

  it('deve atualizar metadados e descrição do nó', () => {
    const store = useGraphStore.getState()
    const nodeA = store.addRootNode('Mecânica Quântica')

    store.updateNode(nodeA, {
      description: 'Equação de Schrödinger: $i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle$',
      tags: ['física', 'quântica', 'avançada'],
      color: '#6366f1',
    })

    const updatedNode = useGraphStore.getState().nodes.find((n) => n.id === nodeA)
    expect(updatedNode?.data.description).toContain('\\hat{H}|\\psi\\rangle')
    expect(updatedNode?.data.tags).toHaveLength(3)
    expect(updatedNode?.data.color).toBe('#6366f1')
  })

  it('organizeMap deve reorganizar as raízes com layout Dagre', () => {
    const store = useGraphStore.getState()
    const a = store.addRootNode('A', { x: 0, y: 0 })
    const b = store.addRootNode('B', { x: 0, y: 0 })
    store.addEdge(a, b, 'liga')

    store.organizeMap()

    const posA = useGraphStore.getState().nodes.find((n) => n.id === a)!.position
    const posB = useGraphStore.getState().nodes.find((n) => n.id === b)!.position

    expect(posA.x).not.toBe(posB.x)
  })
})
