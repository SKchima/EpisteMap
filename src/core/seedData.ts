import type { EpistemeNode, EpistemeEdge } from './types'

export const initialSeedNodes: EpistemeNode[] = [
  {
    id: 'node_algebra',
    type: 'compound',
    position: { x: 100, y: 120 },
    data: {
      title: 'Álgebra Abstrata',
      description: 'Estudo de estruturas algébricas como grupos, anéis e corpos.\n\nUma estrutura algébrica é um conjunto $S$ munido de uma ou mais operações binárias satisfazendo axiomas específicos.',
      tags: ['matemática', 'pura'],
      isExpanded: true,
    },
  },
  {
    id: 'node_grupos',
    type: 'compound',
    parentId: 'node_algebra',
    extent: 'parent',
    position: { x: 30, y: 70 },
    data: {
      title: 'Teoria de Grupos',
      description: 'Um grupo $(G, \\cdot)$ satisfaz:\n1. **Associatividade**: $\\forall a,b,c \\in G, (a \\cdot b) \\cdot c = a \\cdot (b \\cdot c)$\n2. **Elemento Neutro**: $\\exists e \\in G, a \\cdot e = e \\cdot a = a$\n3. **Elemento Inverso**: $\\forall a \\in G, \\exists a^{-1} \\in G, a \\cdot a^{-1} = e$',
      tags: ['álgebra', 'simetria'],
      parentId: 'node_algebra',
      isExpanded: true,
    },
  },
  {
    id: 'node_subgrupos',
    type: 'compound',
    parentId: 'node_grupos',
    extent: 'parent',
    position: { x: 20, y: 60 },
    data: {
      title: 'Subgrupos Normais & Quocientes',
      description: 'Um subgrupo $H \\le G$ é normal ($H \\trianglelefteq G$) se:\n$$gHg^{-1} = H \\quad \\forall g \\in G$$\nPermite a construção do grupo quociente $G/H$.',
      tags: ['álgebra', 'homomorfismo'],
      parentId: 'node_grupos',
      isExpanded: true,
    },
  },
  {
    id: 'node_aneis',
    type: 'compound',
    parentId: 'node_algebra',
    extent: 'parent',
    position: { x: 230, y: 70 },
    data: {
      title: 'Anéis e Corpos',
      description: 'Estruturas com duas operações binárias ($+$ e $\\cdot$). Um corpo $\\mathbb{K}$ é um anel comutativo com unidade onde todo elemento não-nulo possui inverso multiplicativo.',
      tags: ['álgebra'],
      parentId: 'node_algebra',
      isExpanded: true,
    },
  },
  {
    id: 'node_geometria',
    type: 'compound',
    position: { x: 580, y: 120 },
    data: {
      title: 'Geometria Diferencial',
      description: 'Estudo de variedades diferenciáveis munidas de tensores métricos de Riemann $g_{ij}$.',
      tags: ['matemática', 'física'],
      isExpanded: true,
    },
  },
  {
    id: 'node_variedades',
    type: 'compound',
    parentId: 'node_geometria',
    extent: 'parent',
    position: { x: 30, y: 70 },
    data: {
      title: 'Variedades Riemannianas',
      description: 'O tensor de curvatura de Riemann é expresso por:\n$$R^l_{\\phantom{l}ijk} = \\partial_j \\Gamma^l_{ik} - \\partial_k \\Gamma^l_{ij} + \\Gamma^l_{js} \\Gamma^s_{ik} - \\Gamma^l_{ks} \\Gamma^s_{ij}$$',
      tags: ['geometria', 'curvatura'],
      parentId: 'node_geometria',
      isExpanded: true,
    },
  },
]

export const initialSeedEdges: EpistemeEdge[] = [
  {
    id: 'edge_algebra_geometria',
    source: 'node_grupos',
    target: 'node_variedades',
    label: 'Grupos de Lie & Simetrias',
  },
]
