import { describe, it, expect } from 'vitest'
import {
  computeNodeSizes,
  buildFlowElements,
  applyDagreLayout,
  findFreePosition,
  computeNodeBoundingBoxes,
  findDropTargetNodeId,
} from '../layout'
import type { KnowledgeNode, KnowledgeEdge } from '../types'

function makeNode(id: string, parentId: string | null = null, extra: Partial<KnowledgeNode['data']> = {}): KnowledgeNode {
  return {
    id,
    parentId,
    position: { x: 0, y: 0 },
    data: { title: id, description: '', tags: [], color: null, collapsed: false, ...extra },
  }
}

describe('layout determinístico de contêineres', () => {
  it('atribui dimensões de folha para nós sem filhos ou colapsados', () => {
    const nodes = [
      makeNode('a'),
      makeNode('b', null, { collapsed: true }),
      makeNode('c', 'b'), // filho de b colapsado
    ]

    const sizes = computeNodeSizes(nodes)
    expect(sizes.get('a')).toEqual({ width: 232, height: 224 })
    expect(sizes.get('b')).toEqual({ width: 232, height: 224 })
  })

  it('calcula dimensão de contêiner suficiente para envolver os filhos sem sobreposição', () => {
    const nodes = [
      makeNode('parent'),
      makeNode('child1', 'parent'),
      makeNode('child2', 'parent'),
    ]

    const sizes = computeNodeSizes(nodes)
    const pSize = sizes.get('parent')!
    const cSize = sizes.get('child1')!

    expect(cSize).toEqual({ width: 232, height: 224 })
    // O pai deve ter largura e altura maiores que os filhos
    expect(pSize.width).toBeGreaterThan(cSize.width)
    expect(pSize.height).toBeGreaterThan(cSize.height)
  })

  it('posiciona filhos dentro do contêiner sem que eles se sobreponham', () => {
    const nodes = [
      makeNode('parent'),
      makeNode('child1', 'parent'),
      makeNode('child2', 'parent'),
    ]

    const { flowNodes } = buildFlowElements(nodes, [], { focusId: null, selectedId: null })
    const c1 = flowNodes.find((n) => n.id === 'child1')!
    const c2 = flowNodes.find((n) => n.id === 'child2')!

    expect(c1.parentId).toBe('parent')
    expect(c2.parentId).toBe('parent')
    expect(c1.position.x).toBeGreaterThanOrEqual(16)
    expect(c1.position.y).toBeGreaterThanOrEqual(48) // cabeçalho

    // Não podem estar na mesma exata posição (não há sobreposição)
    const samePosition = c1.position.x === c2.position.x && c1.position.y === c2.position.y
    expect(samePosition).toBe(false)
  })

  it('emite pais antes dos filhos (requisito estrito do React Flow para sub-flows)', () => {
    const nodes = [
      makeNode('child', 'parent'),
      makeNode('parent'),
    ]

    const { flowNodes } = buildFlowElements(nodes, [], { focusId: null, selectedId: null })
    const parentIdx = flowNodes.findIndex((n) => n.id === 'parent')
    const childIdx = flowNodes.findIndex((n) => n.id === 'child')
    expect(parentIdx).toBeLessThan(childIdx)
  })

  it('no modo drill-down focado, o nó focado vira raiz em (0, 0)', () => {
    const nodes = [
      makeNode('root'),
      makeNode('sub', 'root'),
      makeNode('leaf', 'sub'),
    ]

    const { flowNodes } = buildFlowElements(nodes, [], { focusId: 'sub', selectedId: null })
    expect(flowNodes.map((n) => n.id)).toEqual(['sub', 'leaf'])
    const subFlow = flowNodes.find((n) => n.id === 'sub')!
    expect(subFlow.parentId).toBeUndefined()
    expect(subFlow.position).toEqual({ x: 0, y: 0 })
  })

  it('no modo drill-down focado, o nó focado expande automaticamente mesmo se estiver colapsado', () => {
    const nodes = [
      makeNode('root'),
      makeNode('sec', 'root', { collapsed: true }),
      makeNode('def1', 'sec'),
      makeNode('def2', 'sec'),
    ]

    const overview = buildFlowElements(nodes, [], { focusId: null, selectedId: null })
    expect(overview.flowNodes.map((n) => n.id)).toEqual(['root', 'sec'])
    expect(overview.flowNodes.find((n) => n.id === 'sec')?.data.collapsed).toBe(true)

    const drill = buildFlowElements(nodes, [], { focusId: 'sec', selectedId: null })
    expect(drill.flowNodes.map((n) => n.id)).toEqual(['sec', 'def1', 'def2'])
    const secFlow = drill.flowNodes.find((n) => n.id === 'sec')!
    expect(secFlow.data.collapsed).toBe(false)
    expect(secFlow.data.isContainer).toBe(true)
    expect(secFlow.parentId).toBeUndefined()
    expect(secFlow.position).toEqual({ x: 0, y: 0 })
  })

  it('eleva arestas para o nó visível quando o destino estiver dentro de nó colapsado', () => {
    const nodes = [
      makeNode('rootA'),
      makeNode('childA', 'rootA'),
      makeNode('rootB', null, { collapsed: true }),
      makeNode('childB', 'rootB'), // oculto
    ]

    const edges: KnowledgeEdge[] = [
      { id: 'e1', source: 'childA', target: 'childB', label: 'conecta' },
    ]

    const { flowNodes, flowEdges } = buildFlowElements(nodes, edges, { focusId: null, selectedId: null })
    expect(flowNodes.find((n) => n.id === 'rootA')?.width).toBe(264)
    expect(flowNodes.find((n) => n.id === 'rootB')?.width).toBe(232)
    expect(flowNodes[0].height).toBeGreaterThanOrEqual(112)
    expect(flowEdges).toHaveLength(1)
    expect(flowEdges[0].source).toBe('childA')
    expect(flowEdges[0].target).toBe('rootB') // elevado para o pai visível
    expect(flowEdges[0].labelStyle).toBeDefined()
    expect(flowEdges[0].labelBgStyle).toBeDefined()
  })

  it('findDropTargetNodeId identifica o contêiner mais específico e previne ciclos em drag-and-drop', () => {
    const nodes = [
      { ...makeNode('container'), position: { x: 0, y: 0 } },
      makeNode('inner', 'container'),
      { ...makeNode('dragged'), position: { x: 600, y: 0 } },
    ]

    const { flowNodes } = buildFlowElements(nodes, [], { focusId: null, selectedId: null })
    const boxes = computeNodeBoundingBoxes(flowNodes)
    const innerBox = boxes.get('inner')!

    // Soltar no centro do filho interno deve escolher 'inner' (menor área) em vez de 'container'
    const targetInner = findDropTargetNodeId(nodes, flowNodes, 'dragged', {
      x: innerBox.x + 20,
      y: innerBox.y + 20,
    })
    expect(targetInner).toBe('inner')

    // Soltar no cabeçalho do contêiner (fora de 'inner') deve escolher 'container'
    const targetOuter = findDropTargetNodeId(nodes, flowNodes, 'dragged', {
      x: 10,
      y: 10,
    })
    expect(targetOuter).toBe('container')

    // Tentar arrastar 'container' para dentro de seu próprio filho 'inner' deve retornar null (I8)
    const invalidCycle = findDropTargetNodeId(nodes, flowNodes, 'container', {
      x: innerBox.x + 20,
      y: innerBox.y + 20,
    })
    expect(invalidCycle).toBeNull()
  })
})

describe('distribuição espacial e auto-layout Dagre', () => {
  it('findFreePosition encontra um local livre para novo nó sem colidir', () => {
    const existing = [
      { ...makeNode('a'), position: { x: 100, y: 100 } },
    ]

    const pos = findFreePosition(existing, { x: 100, y: 100 }, 232, 112)
    // Não pode ser exatamente (100, 100)
    expect(pos.x !== 100 || pos.y !== 100).toBe(true)
  })

  it('applyDagreLayout distribui os nós raízes espalhando-os no espaço', () => {
    const nodes = [
      makeNode('a'),
      makeNode('b'),
      makeNode('c'),
    ]
    const edges: KnowledgeEdge[] = [
      { id: 'e1', source: 'a', target: 'b', label: '' },
      { id: 'e2', source: 'b', target: 'c', label: '' },
    ]

    const layouted = applyDagreLayout(nodes, edges)
    const posA = layouted.find((n) => n.id === 'a')!.position
    const posB = layouted.find((n) => n.id === 'b')!.position
    const posC = layouted.find((n) => n.id === 'c')!.position

    // Devem ter coordenadas distintas espalhadas horizontalmente (LR) ou verticalmente
    expect(posA.x).not.toBe(posB.x)
    expect(posB.x).not.toBe(posC.x)
  })

  it('applyDagreLayout distribui raízes desconexas em grade de 2 colunas', () => {
    const nodes = [
      makeNode('r1'),
      makeNode('r2'),
      makeNode('r3'),
      makeNode('r4'),
    ]

    const layouted = applyDagreLayout(nodes, [])
    const p1 = layouted.find((n) => n.id === 'r1')!.position
    const p2 = layouted.find((n) => n.id === 'r2')!.position
    const p3 = layouted.find((n) => n.id === 'r3')!.position
    const p4 = layouted.find((n) => n.id === 'r4')!.position

    // Na trilha de conhecimento horizontal, raízes desconexas progridem da esquerda para a direita
    expect(p1.x).toBeLessThan(p2.x)
    expect(p2.x).toBeLessThan(p3.x)
    expect(p3.x).toBeLessThan(p4.x)
    expect(p1.y).toBe(p2.y)
    expect(p2.y).toBe(p3.y)
  })

  it('mantém objetos estendidos com sub-objetos visíveis por padrão em qualquer distância', () => {
    const nodes = [
      makeNode('materia_algebra', null, { title: 'Álgebra Abstrata', collapsed: false }),
      makeNode('capitulo_grupos', 'materia_algebra', { title: 'Teoria de Grupos' }),
      makeNode('capitulo_aneis', 'materia_algebra', { title: 'Anéis e Corpos' }),
    ]

    const { flowNodes } = buildFlowElements(nodes, [], {
      focusId: null,
      selectedId: null,
      lodLevel: 'macro',
    })

    // Sub-objetos permanecem visíveis em qualquer distância
    expect(flowNodes.map((n) => n.id)).toEqual(['materia_algebra', 'capitulo_grupos', 'capitulo_aneis'])

    const rootFlow = flowNodes.find((n) => n.id === 'materia_algebra')!
    expect(rootFlow.data.isContainer).toBe(true)
    expect(rootFlow.data.collapsed).toBe(false)
    expect(rootFlow.data.childCount).toBe(2)
  })

  it('organiza sub-nós (definições e teoremas) lado a lado na mesma linha horizontal (LR)', () => {
    const nodes = [
      makeNode('grupo', null, { title: 'Teoria dos Grupos', collapsed: false }),
      makeNode('axioma', 'grupo', { title: 'Axiomas de Grupo' }),
      makeNode('definicao', 'grupo', { title: 'Subgrupos' }),
      makeNode('teorema', 'grupo', { title: 'Teorema de Lagrange' }),
    ]

    const { flowNodes } = buildFlowElements(nodes, [], { focusId: null, selectedId: null })
    const axioma = flowNodes.find((n) => n.id === 'axioma')!
    const definicao = flowNodes.find((n) => n.id === 'definicao')!
    const teorema = flowNodes.find((n) => n.id === 'teorema')!

    // Todos devem estar na mesma linha superior (y idêntico, nenhum vai para baixo de outro)
    expect(axioma.position.y).toBe(definicao.position.y)
    expect(definicao.position.y).toBe(teorema.position.y)

    // E dispostos rigorosamente lado a lado (x crescente para a direita)
    expect(axioma.position.x).toBeLessThan(definicao.position.x)
    expect(definicao.position.x).toBeLessThan(teorema.position.x)
  })

  it('posiciona axiomas e precedentes no extremo esquerdo por ordenação topológica', () => {
    const nodes = [
      makeNode('grupo', null, { title: 'Teoria dos Grupos', collapsed: false }),
      // Fornecido em ordem invertida intencionalmente
      makeNode('teorema', 'grupo', { title: 'Teorema de Lagrange' }),
      makeNode('axioma', 'grupo', { title: 'Axiomas de Grupo' }),
    ]
    const edges = [
      { id: 'e1', source: 'axioma', target: 'teorema', label: 'fundamenta' },
    ]

    const { flowNodes } = buildFlowElements(nodes, edges, { focusId: null, selectedId: null })
    const axioma = flowNodes.find((n) => n.id === 'axioma')!
    const teorema = flowNodes.find((n) => n.id === 'teorema')!

    // O axioma deve ser colocado à esquerda do teorema que depende dele
    expect(axioma.position.x).toBeLessThan(teorema.position.x)
  })

  it('expande nós folha verticalmente para baixo quando possuem descrições com equações ricas', () => {
    const nodeSimples = makeNode('leaf1', null, { description: 'Breve nota' })
    const nodeRico = makeNode('leaf2', null, {
      description: 'Definição formal:\n$$\\int_{-\\infty}^\\infty e^{-x^2} dx = \\sqrt{\\pi}$$\nPropriedades e axiomas detalhados com demonstração extensa.',
    })

    const sizes = computeNodeSizes([nodeSimples, nodeRico])
    const s1 = sizes.get('leaf1')!
    const s2 = sizes.get('leaf2')!

    // Largura permanece padronizada no grid horizontal
    expect(s1.width).toBe(232)
    expect(s2.width).toBe(232)

    // Altura se estende verticalmente para baixo para acomodar o texto
    expect(s2.height).toBeGreaterThan(s1.height)
  })
})
