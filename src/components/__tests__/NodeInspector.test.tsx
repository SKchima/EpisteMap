import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

  it('deve renderizar handle de redimensionamento e permitir redimensionar por teclado e duplo clique', () => {
    localStorage.clear()
    render(<NodeInspector />)

    const resizer = screen.getByRole('separator', { name: /Redimensionar painel lateral/i })
    expect(resizer).toBeInTheDocument()
    expect(resizer).toHaveAttribute('aria-valuenow', '380')

    // Pressionar ArrowLeft aumenta a largura em 20px
    fireEvent.keyDown(resizer, { key: 'ArrowLeft' })
    expect(resizer).toHaveAttribute('aria-valuenow', '400')
    expect(localStorage.getItem('epistemap:inspector-width')).toBe('400')

    // Pressionar ArrowRight diminui a largura em 20px
    fireEvent.keyDown(resizer, { key: 'ArrowRight' })
    expect(resizer).toHaveAttribute('aria-valuenow', '380')
    expect(localStorage.getItem('epistemap:inspector-width')).toBe('380')

    // Duplo clique restaura a largura padrão
    fireEvent.keyDown(resizer, { key: 'ArrowLeft' })
    fireEvent.keyDown(resizer, { key: 'ArrowLeft' })
    expect(resizer).toHaveAttribute('aria-valuenow', '420')
    fireEvent.doubleClick(resizer)
    expect(resizer).toHaveAttribute('aria-valuenow', '380')
  })

  it('deve permitir recolher e expandir o painel lateral com dock rail acessível', () => {
    localStorage.clear()
    useGraphStore.getState().setInspectorOpen(true)
    const { rerender } = render(<NodeInspector />)

    // Aberto: exibe botão de recolher
    const collapseBtn = screen.getByRole('button', { name: /Recolher inspetor/i })
    expect(collapseBtn).toBeInTheDocument()

    // Clicar em recolher
    fireEvent.click(collapseBtn)
    expect(useGraphStore.getState().isInspectorOpen).toBe(false)
    expect(localStorage.getItem('epistemap:inspector-open')).toBe('false')

    rerender(<NodeInspector />)

    // Modo recolhido: exibe dock rail de 36px com label acessível
    const dockRail = screen.getByLabelText('Inspetor de Conhecimento Recolhido')
    expect(dockRail).toBeInTheDocument()
    const expandBtn = screen.getByRole('button', { name: /Expandir inspetor de conhecimento/i })
    expect(expandBtn).toBeInTheDocument()

    // Clicar no botão expandir deve restaurar o painel completo
    fireEvent.click(expandBtn)
    expect(useGraphStore.getState().isInspectorOpen).toBe(true)
    expect(localStorage.getItem('epistemap:inspector-open')).toBe('true')

    rerender(<NodeInspector />)
    expect(screen.getByText('Inspetor de Conhecimento')).toBeInTheDocument()
  })

  it('deve renderizar nós e arestas no Modo de Visualização sem inputs mutáveis nem botões de exclusão', () => {
    const store = useGraphStore.getState()
    store.setEditorMode('view')

    const parentId = store.addRootNode('Álgebra Abstrata')
    const nodeId = store.addSubNode(parentId, 'Teoria de Galois')
    store.updateNode(nodeId, {
      description: 'Conecta extensões de corpos a [[Grupos de Galois]].',
      tags: ['álgebra', 'matemática'],
    })
    store.select(nodeId)

    const { rerender } = render(<NodeInspector />)

    // Título é renderizado como cabeçalho de leitura e não input editável
    expect(screen.getByRole('heading', { level: 2, name: 'Teoria de Galois' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/TÍTULO DO CONCEITO/i)).not.toBeInTheDocument()

    // Inputs de tag, pai e botão de exclusão não devem existir
    expect(screen.queryByLabelText(/TAGS/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nó Pai')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir Nó e Sub-objetos/i })).not.toBeInTheDocument()

    // Tags aparecem como badges informativos (#álgebra, #matemática)
    expect(screen.getByText('#álgebra')).toBeInTheDocument()
    expect(screen.getByText('#matemática')).toBeInTheDocument()

    // Red Link no modo visualização é texto estático desabilitado, não um botão de criação
    expect(screen.queryByRole('button', { name: /Grupos de Galois/i })).not.toBeInTheDocument()
    expect(screen.getByText('[[Grupos de Galois]]')).toBeInTheDocument()

    // Agora seleciona uma aresta
    act(() => {
      const otherId = store.addRootNode('Extensão de Corpos')
      const edgeId = store.addEdge(nodeId, otherId, 'estrutura')
      store.select(edgeId)
    })

    rerender(<NodeInspector />)

    expect(screen.getByText(/Relação Semântica/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/RÓTULO DA RELAÇÃO/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir Relação/i })).not.toBeInTheDocument()
    expect(screen.getByText('estrutura')).toBeInTheDocument()

    // Restaura modo para edit
    act(() => {
      store.setEditorMode('edit')
    })
  })
})

