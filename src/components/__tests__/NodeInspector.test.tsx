import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeInspector } from '../NodeInspector'
import { useGraphStore } from '../../core/graphStore'

describe('NodeInspector (Inspetor de Conhecimento)', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
  })

  it('deve exibir painel de estatísticas quando nenhum nó estiver selecionado', () => {
    useGraphStore.getState().addRootNode('A')
    useGraphStore.getState().select(null)

    render(<NodeInspector />)
    expect(screen.getByText('Inspetor de Conhecimento')).toBeInTheDocument()
    expect(screen.getByText('Estatísticas do Grafo')).toBeInTheDocument()
  })

  it('deve renderizar dados do nó selecionado e permitir edição de título e múltiplas tags com vírgula', () => {
    const store = useGraphStore.getState()
    const nodeId = store.addRootNode('Física Moderna')
    store.updateNode(nodeId, { tags: ['relatividade'] })

    render(<NodeInspector />)

    const titleInput = screen.getByLabelText(/TÍTULO DO CONCEITO/i) as HTMLInputElement
    expect(titleInput.value).toBe('Física Moderna')

    fireEvent.change(titleInput, { target: { value: 'Física Quântica' } })
    expect(useGraphStore.getState().nodes[0].data.title).toBe('Física Quântica')

    const tagsInput = screen.getByLabelText(/TAGS/i) as HTMLInputElement
    expect(tagsInput.value).toBe('relatividade')

    // Digitar vírgula intermediária não deve ser engolida antes do blur/Enter
    fireEvent.change(tagsInput, { target: { value: 'relatividade, quântica, spin' } })
    expect(tagsInput.value).toBe('relatividade, quântica, spin')

    fireEvent.blur(tagsInput)
    expect(useGraphStore.getState().nodes[0].data.tags).toEqual([
      'relatividade',
      'quântica',
      'spin',
    ])
  })

  it('deve renderizar Red Links [[Conceito Inexistente]] e criar novo nó raiz conectado com 1 clique', () => {
    const store = useGraphStore.getState()
    const nodeId = store.addRootNode('Análise Real')
    store.updateNode(nodeId, {
      description: 'Relaciona-se diretamente com [[Medida de Lebesgue]].',
    })

    render(<NodeInspector />)

    const redLinkBtn = screen.getByRole('button', { name: /Medida de Lebesgue/i })
    expect(redLinkBtn).toBeInTheDocument()

    fireEvent.click(redLinkBtn)

    const state = useGraphStore.getState()
    expect(state.nodes).toHaveLength(2)
    const createdNode = state.nodes.find((n) => n.data.title === 'Medida de Lebesgue')
    expect(createdNode).toBeDefined()
    expect(state.selectedId).toBe(createdNode?.id)
    expect(state.edges).toHaveLength(1)
    expect(state.edges[0].source).toBe(nodeId)
    expect(state.edges[0].target).toBe(createdNode?.id)
  })

  it('deve permitir reparenting pelo seletor de Nó Pai e exclusão via modal dark de confirmação', () => {
    const store = useGraphStore.getState()
    const parentA = store.addRootNode('Matemática')
    const nodeB = store.addRootNode('Cálculo')

    store.select(nodeB)
    render(<NodeInspector />)

    const parentSelect = screen.getByLabelText('Nó Pai') as HTMLSelectElement
    expect(parentSelect.value).toBe('')

    fireEvent.change(parentSelect, { target: { value: parentA } })
    expect(useGraphStore.getState().nodes.find((n) => n.id === nodeB)?.parentId).toBe(parentA)

    // Testar modal de confirmação de exclusão
    const deleteTrigger = screen.getByRole('button', { name: /Excluir Nó e Sub-objetos/i })
    fireEvent.click(deleteTrigger)

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /Confirmar Exclusão/i })
    fireEvent.click(confirmBtn)

    expect(useGraphStore.getState().nodes.find((n) => n.id === nodeB)).toBeUndefined()
  })

  it('deve exibir o Inspetor de Aresta quando uma aresta estiver selecionada e editar seu rótulo', () => {
    const store = useGraphStore.getState()
    const a = store.addRootNode('Grupos')
    const b = store.addRootNode('Anéis')
    const edgeId = store.addEdge(a, b, 'estende')
    store.select(edgeId)

    render(<NodeInspector />)

    expect(screen.getByText(/Relação Semântica/i)).toBeInTheDocument()
    const labelInput = screen.getByLabelText(/RÓTULO DA RELAÇÃO/i) as HTMLInputElement
    expect(labelInput.value).toBe('estende')

    fireEvent.change(labelInput, { target: { value: 'enriquece' } })
    expect(useGraphStore.getState().edges[0].label).toBe('enriquece')

    // Excluir a aresta pelo inspetor deve removê-la e limpar a seleção
    const deleteEdgeBtn = screen.getByRole('button', { name: /Excluir Relação/i })
    fireEvent.click(deleteEdgeBtn)
    expect(useGraphStore.getState().edges).toHaveLength(0)
    expect(useGraphStore.getState().selectedId).toBeNull()
  })

  it('deve renderizar [[WikiLinks]] aninhados dentro de formatação Markdown (**negrito** / *itálico*) e não poluir undo em blur de tags sem edição', () => {
    const store = useGraphStore.getState()
    const targetId = store.addRootNode('Espaço de Hilbert')
    const sourceId = store.addRootNode('Mecânica Quântica')
    store.updateNode(sourceId, {
      description: 'Baseia-se fortemente em **[[Espaço de Hilbert]]** e *[[Operadores Hermiteanos]]*.',
      tags: ['física'],
    })
    store.select(sourceId)
    useGraphStore.temporal.getState().clear()

    render(<NodeInspector />)

    // Focar e desfocar input de tags sem alterar nada não deve criar entrada no histórico
    const tagsInput = screen.getByLabelText(/TAGS/i)
    fireEvent.focus(tagsInput)
    fireEvent.blur(tagsInput)
    expect(useGraphStore.temporal.getState().pastStates).toHaveLength(0)

    // WikiLink existente dentro de **negrito** deve ser clicável
    const wikiBtn = screen.getByRole('button', { name: 'Espaço de Hilbert' })
    expect(wikiBtn).toBeInTheDocument()
    fireEvent.click(wikiBtn)
    expect(useGraphStore.getState().selectedId).toBe(targetId)
  })
})
