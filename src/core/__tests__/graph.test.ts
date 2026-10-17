import { describe, it, expect } from 'vitest'
import {
  canReparent,
  extractWikiLinks,
  findNodeByTitle,
  getAncestorIds,
  getBacklinks,
  getBreadcrumbs,
  getSubtreeIds,
  isNodeInsideBoundingBox,
  resolveColor,
  sanitizeGraph,
  searchNodes,
} from '../graph'
import type { KnowledgeNode } from '../types'

function node(id: string, parentId: string | null = null, extra: Partial<KnowledgeNode['data']> = {}): KnowledgeNode {
  return {
    id,
    parentId,
    position: { x: 0, y: 0 },
    data: { title: id, description: '', tags: [], color: null, collapsed: false, ...extra },
  }
}

// a ── b ── c
//  └── d
// e
const tree = [node('a'), node('b', 'a'), node('c', 'b'), node('d', 'a'), node('e')]

describe('hierarquia', () => {
  it('getSubtreeIds inclui o próprio nó e todos os descendentes', () => {
    expect(getSubtreeIds(tree, 'a')).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(getSubtreeIds(tree, 'c')).toEqual(new Set(['c']))
  })

  it('getAncestorIds vai do pai até a raiz', () => {
    expect(getAncestorIds(tree, 'c')).toEqual(['b', 'a'])
    expect(getAncestorIds(tree, 'a')).toEqual([])
  })

  it('getBreadcrumbs reflete a cadeia raiz → foco', () => {
    expect(getBreadcrumbs(tree, null)).toEqual([{ id: null, title: 'Visão geral' }])
    expect(getBreadcrumbs(tree, 'c').map((b) => b.id)).toEqual([null, 'a', 'b', 'c'])
  })

  it('canReparent rejeita o próprio nó e descendentes (I8)', () => {
    expect(canReparent(tree, 'a', 'a')).toBe(false)
    expect(canReparent(tree, 'a', 'c')).toBe(false)
    expect(canReparent(tree, 'c', 'e')).toBe(true)
    expect(canReparent(tree, 'c', null)).toBe(true)
    expect(canReparent(tree, 'c', 'inexistente')).toBe(false)
  })

  it('resolveColor herda a cor do ancestral mais próximo', () => {
    const colored = [node('a', null, { color: '#f00' }), node('b', 'a'), node('c', 'b', { color: '#0f0' }), node('d', 'c')]
    expect(resolveColor(colored, 'b')).toBe('#f00')
    expect(resolveColor(colored, 'd')).toBe('#0f0')
    expect(resolveColor(tree, 'c')).toBeNull()
  })

  it('isNodeInsideBoundingBox detecta colisão espacial corretamente', () => {
    const rect = { x: 100, y: 200, width: 300, height: 150 }
    expect(isNodeInsideBoundingBox({ x: 250, y: 275 }, rect)).toBe(true)
    expect(isNodeInsideBoundingBox({ x: 100, y: 200 }, rect)).toBe(true)
    expect(isNodeInsideBoundingBox({ x: 400, y: 350 }, rect)).toBe(true)
    expect(isNodeInsideBoundingBox({ x: 99, y: 250 }, rect)).toBe(false)
    expect(isNodeInsideBoundingBox({ x: 250, y: 351 }, rect)).toBe(false)
  })

  it('searchNodes filtra e classifica por título, tags e descrição com caminho hierárquico', () => {
    const sample = [
      node('root', null, { title: 'Álgebra Abstrata', tags: ['matemática'] }),
      node('sub', 'root', {
        title: 'Teoria de Grupos',
        tags: ['simetria', 'estruturas'],
        description: 'Estuda o Teorema de Lagrange e subgrupos normais.',
      }),
      node('other', null, {
        title: 'Mecânica Clássica',
        tags: ['física'],
        description: 'Usa conceitos de simetria via Noether.',
      }),
    ]

    expect(searchNodes(sample, '')).toHaveLength(3)

    const byTitle = searchNodes(sample, 'Grupos')
    expect(byTitle[0].node.id).toBe('sub')
    expect(byTitle[0].matchType).toBe('title')
    expect(byTitle[0].path).toEqual(['Álgebra Abstrata'])

    const byTag = searchNodes(sample, '#simetria')
    expect(byTag.map((r) => r.node.id)).toEqual(['sub', 'other'])
    expect(byTag[0].matchType).toBe('tag')
    expect(byTag[1].matchType).toBe('description')

    const byDesc = searchNodes(sample, 'Lagrange')
    expect(byDesc).toHaveLength(1)
    expect(byDesc[0].node.id).toBe('sub')
    expect(byDesc[0].matchType).toBe('description')
  })
})

describe('links entre nós', () => {
  it('extractWikiLinks encontra [[títulos]] sem duplicar', () => {
    expect(extractWikiLinks('Ver [[Grupos]] e [[ Anéis ]], de novo [[Grupos]].')).toEqual(['Grupos', 'Anéis'])
    expect(extractWikiLinks('sem links')).toEqual([])
  })

  it('findNodeByTitle ignora caixa e espaços nas pontas', () => {
    const nodes = [node('x', null, { title: 'Teoria de Grupos' })]
    expect(findNodeByTitle(nodes, '  teoria de grupos ')?.id).toBe('x')
    expect(findNodeByTitle(nodes, 'Anéis')).toBeUndefined()
  })

  it('getBacklinks lista nós cuja descrição referencia o título do alvo', () => {
    const nodes = [
      node('g', null, { title: 'Grupos' }),
      node('h', null, { description: 'Generaliza [[grupos]].' }),
      node('i', null, { description: 'Nada aqui.' }),
    ]
    expect(getBacklinks(nodes, 'g').map((n) => n.id)).toEqual(['h'])
  })
})

describe('sanitizeGraph', () => {
  it('rejeita entradas sem array de nós', () => {
    expect(() => sanitizeGraph(null)).toThrow()
    expect(() => sanitizeGraph({ edges: [] })).toThrow()
  })

  it('preenche campos ausentes com valores padrão', () => {
    const g = sanitizeGraph({ nodes: [{ id: 'a' }] })
    expect(g.nodes[0]).toEqual({
      id: 'a',
      parentId: null,
      position: { x: 0, y: 0 },
      data: { title: 'Sem título', description: '', tags: [], color: null, collapsed: false },
    })
    expect(g.edges).toEqual([])
  })

  it('descarta nós sem id e ids duplicados (I1)', () => {
    const g = sanitizeGraph({ nodes: [{ id: 'a' }, { title: 'sem id' }, { id: 'a' }] })
    expect(g.nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('promove a raiz nós com pai inexistente (I2)', () => {
    const g = sanitizeGraph({ nodes: [{ id: 'a', parentId: 'fantasma' }] })
    expect(g.nodes[0].parentId).toBeNull()
  })

  it('desfaz ciclos promovendo um nó a raiz (I3)', () => {
    const g = sanitizeGraph({ nodes: [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }] })
    const roots = g.nodes.filter((n) => n.parentId === null)
    expect(roots.length).toBeGreaterThanOrEqual(1)
    for (const n of g.nodes) expect(getAncestorIds(g.nodes, n.id)).not.toContain(n.id)
  })

  it('garante que pais aparecem antes dos filhos no array', () => {
    const g = sanitizeGraph({ nodes: [{ id: 'c', parentId: 'p' }, { id: 'p' }] })
    expect(g.nodes.map((n) => n.id)).toEqual(['p', 'c'])
  })

  it('descarta arestas inválidas, laços e duplicatas (I4)', () => {
    const g = sanitizeGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [
        { id: 'e1', source: 'a', target: 'b', label: 'ok' },
        { id: 'e2', source: 'a', target: 'b' },
        { id: 'e3', source: 'a', target: 'a' },
        { id: 'e4', source: 'a', target: 'z' },
      ],
    })
    expect(g.edges).toEqual([{ id: 'e1', source: 'a', target: 'b', label: 'ok' }])
  })

  it('converte o formato v1 (React Flow + isExpanded)', () => {
    const g = sanitizeGraph({
      nodes: [
        { id: 'p', type: 'compound', position: { x: 10, y: 20 }, data: { title: 'P', isExpanded: false, tags: ['t'] } },
        { id: 'c', parentId: 'p', extent: 'parent', measured: { width: 1 }, position: { x: 1, y: 1 }, data: { title: 'C', parentId: 'p' } },
      ],
      edges: [{ id: 'e', source: 'p', target: 'c', animated: true }],
    })
    expect(g.nodes[0]).toMatchObject({ id: 'p', parentId: null, position: { x: 10, y: 20 } })
    expect(g.nodes[0].data).toEqual({ title: 'P', description: '', tags: ['t'], color: null, collapsed: true })
    expect(g.nodes[1].parentId).toBe('p')
    expect(Object.keys(g.nodes[1]).sort()).toEqual(['data', 'id', 'parentId', 'position'])
    expect(g.edges[0]).toEqual({ id: 'e', source: 'p', target: 'c', label: '' })
  })
})
