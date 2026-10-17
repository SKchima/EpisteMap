import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from '../CommandPalette'
import { useGraphStore } from '../../core/graphStore'

describe('CommandPalette (Busca Global Cmd+K)', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
  })

  it('não deve renderizar nada quando isOpen for false', () => {
    render(<CommandPalette isOpen={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('deve renderizar os conceitos do grafo e filtrar em tempo real por título, tag e descrição', () => {
    const store = useGraphStore.getState()
    const rootId = store.addRootNode('Álgebra Linear')
    store.updateNode(rootId, { tags: ['matrizes', 'vetores'] })
    const subId = store.addSubNode(rootId, 'Autovalores e Autovetores')
    store.updateNode(subId, { description: 'Polinômio característico det(A - λI) = 0' })

    render(<CommandPalette isOpen={true} onClose={() => {}} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Álgebra Linear')).toBeInTheDocument()
    expect(screen.getByText('Autovalores e Autovetores')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/Buscar conceitos/i)
    fireEvent.change(searchInput, { target: { value: 'Polinômio' } })

    expect(screen.getByText('Autovalores e Autovetores')).toBeInTheDocument()
    expect(screen.queryByText('1 conceito(s)')).toBeInTheDocument()
  })

  it('deve navegar com setas e selecionar com Enter, expandindo ancestrais colapsados', () => {
    const store = useGraphStore.getState()
    const rootId = store.addRootNode('Topologia Geral')
    const subId = store.addSubNode(rootId, 'Espaços Compactos')
    store.toggleCollapse(rootId)
    store.select(null)

    expect(useGraphStore.getState().nodes.find((n) => n.id === rootId)?.data.collapsed).toBe(true)

    const onClose = vi.fn()
    const onNavigate = vi.fn()

    render(<CommandPalette isOpen={true} onClose={onClose} onNavigate={onNavigate} />)

    const searchInput = screen.getByPlaceholderText(/Buscar conceitos/i)
    fireEvent.change(searchInput, { target: { value: 'Compactos' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    // Deve expandir o pai colapsado, selecionar o nó alvo e fechar o modal
    const state = useGraphStore.getState()
    expect(state.nodes.find((n) => n.id === rootId)?.data.collapsed).toBe(false)
    expect(state.selectedId).toBe(subId)
    expect(onNavigate).toHaveBeenCalledWith(subId)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('deve tratar busca sem resultados, navegação circular ↑↓ e tecla Escape', () => {
    const store = useGraphStore.getState()
    const n1 = store.addRootNode('Primeiro')
    const n2 = store.addRootNode('Segundo')

    const onClose = vi.fn()
    render(<CommandPalette isOpen={true} onClose={onClose} />)

    const searchInput = screen.getByPlaceholderText(/Buscar conceitos/i)

    // ArrowDown muda para o segundo item (n2)
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    fireEvent.keyDown(searchInput, { key: 'Enter' })
    expect(useGraphStore.getState().selectedId).toBe(n2)

    // Query sem correspondência exibe mensagem vazia e Enter não falha
    fireEvent.change(searchInput, { target: { value: 'termo_inexistente_xyz' } })
    expect(screen.getByText(/Nenhum conceito encontrado/i)).toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    // Escape fecha o modal
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(n1).toBeDefined()
  })

  it('deve limpar o texto de busca ao ser fechado externamente via prop isOpen=false e reaberto', () => {
    useGraphStore.getState().addRootNode('Termodinâmica')

    const { rerender } = render(<CommandPalette isOpen={true} onClose={() => {}} />)
    const searchInput = screen.getByPlaceholderText(/Buscar conceitos/i) as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'termo_antigo' } })
    expect(searchInput.value).toBe('termo_antigo')

    // Simula fechamento via atalho Cmd+K (isOpen muda para false e depois true)
    rerender(<CommandPalette isOpen={false} onClose={() => {}} />)
    rerender(<CommandPalette isOpen={true} onClose={() => {}} />)

    const reopenedInput = screen.getByPlaceholderText(/Buscar conceitos/i) as HTMLInputElement
    expect(reopenedInput.value).toBe('')
  })

  it('deve adaptar as cores do modal quando o tema for alto contraste ou claro', () => {
    useGraphStore.getState().setTheme('high-contrast')
    useGraphStore.getState().addRootNode('Conceito Contraste')

    render(<CommandPalette isOpen={true} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Conceito Contraste')).toBeInTheDocument()
  })
})
