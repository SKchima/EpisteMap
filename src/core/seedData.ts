import type { KnowledgeNode, KnowledgeEdge } from './types'
import { applyDagreLayout } from './layout'

const rawSeedNodes: KnowledgeNode[] = [
  {
    id: 'node_algebra',
    parentId: null,
    position: { x: 50, y: 100 },
    data: {
      title: 'Álgebra Abstrata',
      description: 'Estudo de estruturas algébricas como [[Teoria de Grupos]], [[Anéis e Corpos]] e álgebras lineares.\n\nUma estrutura algébrica é um conjunto $S$ munido de operações binárias satisfazendo axiomas específicos.',
      tags: ['matemática', 'pura'],
      color: '#6366f1',
      collapsed: false,
    },
  },
  {
    id: 'node_grupos',
    parentId: 'node_algebra',
    position: { x: 0, y: 0 },
    data: {
      title: 'Teoria de Grupos',
      description: 'Um grupo $(G, \\cdot)$ satisfaz:\n1. **Associatividade**: $\\forall a,b,c \\in G, (a \\cdot b) \\cdot c = a \\cdot (b \\cdot c)$\n2. **Elemento Neutro**: $\\exists e \\in G, a \\cdot e = e \\cdot a = a$\n3. **Elemento Inverso**: $\\forall a \\in G, \\exists a^{-1} \\in G, a \\cdot a^{-1} = e$\n\nConecta-se com [[Variedades Riemannianas]] através de grupos de Lie.',
      tags: ['álgebra', 'simetria'],
      color: null,
      collapsed: false,
    },
  },
  {
    id: 'node_subgrupos',
    parentId: 'node_grupos',
    position: { x: 0, y: 0 },
    data: {
      title: 'Subgrupos Normais & Quocientes',
      description: 'Um subgrupo $H \\le G$ é normal ($H \\trianglelefteq G$) se:\n$$gHg^{-1} = H \\quad \\forall g \\in G$$\nPermite a construção do grupo quociente $G/H$.',
      tags: ['álgebra', 'homomorfismo'],
      color: null,
      collapsed: false,
    },
  },
  {
    id: 'node_aneis',
    parentId: 'node_algebra',
    position: { x: 0, y: 0 },
    data: {
      title: 'Anéis e Corpos',
      description: 'Estruturas com duas operações binárias ($+$ e $\\cdot$). Um corpo $\\mathbb{K}$ é um anel comutativo com unidade onde todo elemento não-nulo possui inverso multiplicativo.',
      tags: ['álgebra', 'estruturas'],
      color: null,
      collapsed: false,
    },
  },
  {
    id: 'node_geometria',
    parentId: null,
    position: { x: 600, y: 100 },
    data: {
      title: 'Geometria Diferencial',
      description: 'Estudo de variedades diferenciáveis munidas de tensores métricos de Riemann $g_{ij}$. Aplica-se diretamente à relatividade geral e mecânica geométrica.',
      tags: ['geometria', 'física-matemática'],
      color: '#06b6d4',
      collapsed: false,
    },
  },
  {
    id: 'node_variedades',
    parentId: 'node_geometria',
    position: { x: 0, y: 0 },
    data: {
      title: 'Variedades Riemannianas',
      description: 'O tensor de curvatura de Riemann é expresso por:\n$$R^l_{\\phantom{l}ijk} = \\partial_j \\Gamma^l_{ik} - \\partial_k \\Gamma^l_{ij} + \\Gamma^l_{js} \\Gamma^s_{ik} - \\Gamma^l_{ks} \\Gamma^s_{ij}$$',
      tags: ['geometria', 'curvatura'],
      color: null,
      collapsed: false,
    },
  },
  {
    id: 'node_computacao',
    parentId: null,
    position: { x: 300, y: 500 },
    data: {
      title: 'Ciência da Computação Teórica',
      description: 'Fundamentos matemáticos da computação: autômatos, complexidade computacional e teoria dos tipos.\n\nRelaciona-se com a lógica através do isomorfismo de Curry-Howard.',
      tags: ['computação', 'lógica'],
      color: '#10b981',
      collapsed: false,
    },
  },
  {
    id: 'node_complexidade',
    parentId: 'node_computacao',
    position: { x: 0, y: 0 },
    data: {
      title: 'Teoria da Complexidade',
      description: 'Classificação de problemas computacionais de acordo com o consumo assintótico de tempo $O(f(n))$ e espaço. Problema central: $\\text{P} \\stackrel{?}{=} \\text{NP}$.',
      tags: ['complexidade', 'algoritmos'],
      color: null,
      collapsed: false,
    },
  },
]

export const initialSeedEdges: KnowledgeEdge[] = [
  {
    id: 'edge_algebra_geometria',
    source: 'node_grupos',
    target: 'node_variedades',
    label: 'Grupos de Lie',
  },
  {
    id: 'edge_algebra_computacao',
    source: 'node_algebra',
    target: 'node_computacao',
    label: 'Semântica Algébrica',
  },
]

export const initialSeedNodes: KnowledgeNode[] = applyDagreLayout(rawSeedNodes, initialSeedEdges)
