import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { CompoundNode } from '../CompoundNode'
import { useGraphStore } from '../../core/graphStore'

describe('CompoundNode - Zoom Semântico por Nível de Detalhe (LoD)', () => {
  beforeEach(() => {
    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedId: null,
      focusId: null,
      activeTag: null,
      theme: 'dark',
    })
  })

  it('deve renderizar nó no nível MACRO com visual minimalista (título em destaque, sem descrição ou botões ruidosos)', () => {
    const nodeProps = {
      id: 'node-1',
      data: {
        title: 'Álgebra Linear',
        description: 'Estudo de espaços vetoriais e transformações lineares',
        tags: ['matematica', 'algebra'],
        collapsed: false,
        color: '#6366f1',
        childCount: 0,
        isContainer: false,
        width: 232,
        height: 112,
        lodLevel: 'macro' as const,
      },
      selected: false,
      zIndex: 1,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      deletable: true,
      selectable: true,
      draggable: true,
      type: 'compound',
    }

    render(
      <ReactFlowProvider>
        <CompoundNode {...nodeProps} />
      </ReactFlowProvider>
    )

    // Título presente
    expect(screen.getByText('Álgebra Linear')).toBeInTheDocument()

    // No modo macro, descrição e botões de adicionar sub-nó são omitidos para evitar ruído ilegível
    expect(screen.queryByText('Estudo de espaços vetoriais')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sub/i })).not.toBeInTheDocument()
  })

  it('deve renderizar nó no nível STANDARD com tags, descrição resumida e botão de adicionar sub-nó', () => {
    const nodeProps = {
      id: 'node-2',
      data: {
        title: 'Topologia Geral',
        description: 'Espaços topológicos e continuidade',
        tags: ['topologia', 'analise'],
        collapsed: false,
        color: '#10b981',
        childCount: 0,
        isContainer: false,
        width: 232,
        height: 112,
        lodLevel: 'standard' as const,
      },
      selected: false,
      zIndex: 1,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      deletable: true,
      selectable: true,
      draggable: true,
      type: 'compound',
    }

    render(
      <ReactFlowProvider>
        <CompoundNode {...nodeProps} />
      </ReactFlowProvider>
    )

    expect(screen.getByText('Topologia Geral')).toBeInTheDocument()
    expect(screen.getByText('Espaços topológicos e continuidade')).toBeInTheDocument()
    expect(screen.getByText('#topologia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sub/i })).toBeInTheDocument()
  })

  it('deve renderizar nó folha no nível MICRO exibindo equações KaTeX ricas diretamente no cartão', () => {
    const nodeProps = {
      id: 'node-3',
      data: {
        title: 'Desigualdade de Cauchy-Schwarz',
        description: 'Para quaisquer vetores, $|\\langle u, v \\rangle| \\le \\|u\\| \\|v\\|$.',
        tags: ['geometria'],
        collapsed: false,
        color: '#f59e0b',
        childCount: 0,
        isContainer: false,
        width: 232,
        height: 112,
        lodLevel: 'micro' as const,
      },
      selected: false,
      zIndex: 1,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      deletable: true,
      selectable: true,
      draggable: true,
      type: 'compound',
    }

    const { container } = render(
      <ReactFlowProvider>
        <CompoundNode {...nodeProps} />
      </ReactFlowProvider>
    )

    expect(screen.getByText('Desigualdade de Cauchy-Schwarz')).toBeInTheDocument()
    // Elementos KaTeX renderizados
    const katexElem = container.querySelector('.katex')
    expect(katexElem).toBeInTheDocument()
  })

  it('deve renderizar contêiner recolhido no nível MICRO exibindo lista interna de seções e definições filhas', () => {
    const nodeProps = {
      id: 'node-parent',
      data: {
        title: 'Espaços Métricos',
        description: 'Fundamentos de métrica e bolas abertas',
        tags: ['analise'],
        collapsed: true,
        color: '#6366f1',
        childCount: 2,
        isContainer: false,
        childrenSummary: [
          { id: 'child-1', title: 'Definição 1.1: Métrica', color: '#6366f1' },
          { id: 'child-2', title: 'Teorema 1.2: Bolas Abertas', color: '#10b981' },
        ],
        width: 232,
        height: 112,
        lodLevel: 'micro' as const,
      },
      selected: false,
      zIndex: 1,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      deletable: true,
      selectable: true,
      draggable: true,
      type: 'compound',
    }

    render(
      <ReactFlowProvider>
        <CompoundNode {...nodeProps} />
      </ReactFlowProvider>
    )

    expect(screen.getByText('Espaços Métricos')).toBeInTheDocument()
    expect(screen.getByText('Definição 1.1: Métrica')).toBeInTheDocument()
    expect(screen.getByText('Teorema 1.2: Bolas Abertas')).toBeInTheDocument()

    // Clicar em uma sub-definição deve selecioná-la na store
    const childDef = screen.getByText('Definição 1.1: Métrica')
    fireEvent.click(childDef)
    expect(useGraphStore.getState().selectedId).toBe('child-1')
  })
})
