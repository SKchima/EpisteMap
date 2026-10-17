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

  it('deve suportar Undo e Redo com zundo sem poluir histórico com seleções efêmeras', () => {
    const store = useGraphStore.getState()
    expect(useGraphStore.getState().canUndo).toBe(false)
    expect(useGraphStore.getState().canRedo).toBe(false)

    // 1. Adicionar nó
    const nodeA = store.addRootNode('Conceito A')
    expect(useGraphStore.getState().nodes).toHaveLength(1)
    expect(useGraphStore.getState().canUndo).toBe(true)
    expect(useGraphStore.getState().canRedo).toBe(false)

    // Seleção efêmera não deve criar entrada extra no histórico
    store.select(null)
    store.select(nodeA)
    expect(useGraphStore.temporal.getState().pastStates).toHaveLength(1)

    // 2. Undo deve remover o nó e limpar selectedId inválido (I7)
    store.undo()
    expect(useGraphStore.getState().nodes).toHaveLength(0)
    expect(useGraphStore.getState().selectedId).toBeNull()
    expect(useGraphStore.getState().canUndo).toBe(false)
    expect(useGraphStore.getState().canRedo).toBe(true)

    // 3. Redo deve restaurar o nó
    store.redo()
    expect(useGraphStore.getState().nodes).toHaveLength(1)
    expect(useGraphStore.getState().nodes[0].id).toBe(nodeA)
    expect(useGraphStore.getState().canUndo).toBe(true)
    expect(useGraphStore.getState().canRedo).toBe(false)
  })

  it('navigateToNode deve expandir ancestrais colapsados e ajustar focusId inteligentemente', () => {
    const store = useGraphStore.getState()
    const rootA = store.addRootNode('Raiz A')
    const midB = store.addSubNode(rootA, 'Intermediário B')
    const leafC = store.addSubNode(midB, 'Folha C')
    const rootD = store.addRootNode('Raiz D')

    // Recolhe rootA e midB e foca em rootD (outra árvore)
    store.toggleCollapse(rootA)
    store.toggleCollapse(midB)
    store.setFocus(rootD)

    expect(useGraphStore.getState().nodes.find((n) => n.id === rootA)?.data.collapsed).toBe(true)
    expect(useGraphStore.getState().nodes.find((n) => n.id === midB)?.data.collapsed).toBe(true)

    // Navegar até leafC deve expandir rootA e midB, sair do focusId de rootD e selecionar leafC
    store.navigateToNode(leafC)

    const updated = useGraphStore.getState()
    expect(updated.nodes.find((n) => n.id === rootA)?.data.collapsed).toBe(false)
    expect(updated.nodes.find((n) => n.id === midB)?.data.collapsed).toBe(false)
    expect(updated.focusId).toBeNull()
    expect(updated.selectedId).toBe(leafC)
  })

  it('updateEdgeLabel deve atualizar o rótulo de uma aresta existente', () => {
    const store = useGraphStore.getState()
    const a = store.addRootNode('A')
    const b = store.addRootNode('B')
    const edgeId = store.addEdge(a, b, 'inicial')

    expect(useGraphStore.getState().edges[0].label).toBe('inicial')

    store.updateEdgeLabel(edgeId, 'fundamenta')
    expect(useGraphStore.getState().edges[0].label).toBe('fundamenta')
  })

  it('createNodeFromWikiLink deve criar conceito raiz a partir de Red Link, conectar aresta e selecioná-lo', () => {
    const store = useGraphStore.getState()
    const sourceId = store.addRootNode('Cálculo')

    const createdId = store.createNodeFromWikiLink(sourceId, 'Equações Diferenciais')
    const state = useGraphStore.getState()

    expect(state.nodes).toHaveLength(2)
    const createdNode = state.nodes.find((n) => n.id === createdId)
    expect(createdNode?.data.title).toBe('Equações Diferenciais')
    expect(createdNode?.parentId).toBeNull()
    expect(state.selectedId).toBe(createdId)
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0].source).toBe(sourceId)
    expect(state.edges[0].target).toBe(createdId)

    // Caso limite: invocar novamente para um título já existente não deve duplicar o nó nem a aresta
    const existingId = store.createNodeFromWikiLink(sourceId, '  equações diferenciais ')
    expect(existingId).toBe(createdId)
    expect(useGraphStore.getState().nodes).toHaveLength(2)
    expect(useGraphStore.getState().edges).toHaveLength(1)
  })

  it('deve lidar com casos de borda em undo/redo múltiplos e navigateToNode inexistente', () => {
    const store = useGraphStore.getState()

    // Undo/Redo com pilhas vazias deve ser no-op seguro
    store.undo()
    store.redo()
    expect(useGraphStore.getState().nodes).toHaveLength(0)

    // 3 operações consecutivas -> 3 undos -> 3 redos
    const n1 = store.addRootNode('N1')
    const n2 = store.addRootNode('N2')
    store.addEdge(n1, n2, 'conecta')

    expect(useGraphStore.getState().nodes).toHaveLength(2)
    expect(useGraphStore.getState().edges).toHaveLength(1)

    store.undo()
    expect(useGraphStore.getState().edges).toHaveLength(0)
    store.undo()
    expect(useGraphStore.getState().nodes).toHaveLength(1)
    store.undo()
    expect(useGraphStore.getState().nodes).toHaveLength(0)

    store.redo()
    store.redo()
    store.redo()
    expect(useGraphStore.getState().nodes).toHaveLength(2)
    expect(useGraphStore.getState().edges).toHaveLength(1)

    // navigateToNode para ID inexistente não altera o estado
    const before = useGraphStore.getState()
    store.navigateToNode('id_inexistente')
    expect(useGraphStore.getState().selectedId).toBe(before.selectedId)
  })

  it('promover múltiplos sub-objetos a raiz sem posição explícita deve distribuí-los sem sobreposição em (0,0)', () => {
    const store = useGraphStore.getState()
    const rootId = store.addRootNode('Raiz', { x: 100, y: 100 })
    const sub1 = store.addSubNode(rootId, 'Sub 1')
    const sub2 = store.addSubNode(rootId, 'Sub 2')

    store.reparentNode(sub1, null)
    store.reparentNode(sub2, null)

    const state = useGraphStore.getState()
    const node1 = state.nodes.find((n) => n.id === sub1)!
    const node2 = state.nodes.find((n) => n.id === sub2)!

    expect(node1.parentId).toBeNull()
    expect(node2.parentId).toBeNull()
    const samePos =
      node1.position.x === node2.position.x && node1.position.y === node2.position.y
    expect(samePos).toBe(false)
  })

  it('reparentNode para um contêiner colapsado deve expandi-lo automaticamente e preservar ordem topológica', () => {
    const store = useGraphStore.getState()
    const childFirst = store.addRootNode('Filho Futuro')
    const targetParent = store.addRootNode('Pai Colapsado')
    store.toggleCollapse(targetParent)
    expect(useGraphStore.getState().nodes.find((n) => n.id === targetParent)?.data.collapsed).toBe(true)

    store.reparentNode(childFirst, targetParent)

    const state = useGraphStore.getState()
    const parentIdx = state.nodes.findIndex((n) => n.id === targetParent)
    const childIdx = state.nodes.findIndex((n) => n.id === childFirst)
    expect(state.nodes[parentIdx].data.collapsed).toBe(false)
    expect(parentIdx).toBeLessThan(childIdx)
  })

  it('deve agrupar digitação rápida consecutiva em um único ponto de undo no zundo e ignorar no-ops', () => {
    const store = useGraphStore.getState()
    const nodeId = store.addRootNode('Inicial', { x: 100, y: 100 })
    useGraphStore.temporal.getState().clear()

    // Digitação rápida de várias letras no título (< 500ms)
    store.updateNode(nodeId, { title: 'F' })
    store.updateNode(nodeId, { title: 'Fí' })
    store.updateNode(nodeId, { title: 'Fís' })
    store.updateNode(nodeId, { title: 'Física' })

    // Deve ter criado apenas 1 estado passado no histórico
    expect(useGraphStore.temporal.getState().pastStates).toHaveLength(1)

    // No-op não deve adicionar estado ao histórico
    store.updateNode(nodeId, { title: 'Física' })
    store.updateRootPosition(nodeId, { x: 100, y: 100 })
    expect(useGraphStore.temporal.getState().pastStates).toHaveLength(1)

    // Um único undo deve restaurar o título para 'Inicial'
    store.undo()
    expect(useGraphStore.getState().nodes.find((n) => n.id === nodeId)?.data.title).toBe('Inicial')
  })

  it('deve limpar activeTag automaticamente quando a última ocorrência da tag for removida ou desfeita', () => {
    const store = useGraphStore.getState()
    const nodeId = store.addRootNode('Óptica')
    store.updateNode(nodeId, { tags: ['fótons'] })
    store.setActiveTag('fótons')
    expect(useGraphStore.getState().activeTag).toBe('fótons')

    // Remover a tag do único nó que a possuía deve resetar activeTag para null
    store.updateNode(nodeId, { tags: [] })
    expect(useGraphStore.getState().activeTag).toBeNull()
  })

  it('undo de nó em foco (I6) deve recuar focusId para o parentId válido em vez de perder todo o contexto', () => {
    const store = useGraphStore.getState()
    const rootId = store.addRootNode('Raiz')
    const subId = store.addSubNode(rootId, 'Sub')
    store.setFocus(subId)
    expect(useGraphStore.getState().focusId).toBe(subId)

    // Desfazer a criação de 'Sub' deve recuar focusId para 'Raiz'
    store.undo()
    expect(useGraphStore.getState().focusId).toBe(rootId)
  })
})
