import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BreadcrumbsBar } from '../BreadcrumbsBar'
import { useGraphStore } from '../../core/graphStore'

vi.mock('html-to-image', () => ({
  toPng: vi.fn(() => Promise.resolve('data:image/png;base64,fake')),
}))

import { toPng } from 'html-to-image'

describe('BreadcrumbsBar (Barra Superior de Navegação, Tags, Histórico e Exportação)', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
    vi.clearAllMocks()
  })

  it('deve exibir trilha de breadcrumbs, permitir navegar ao topo e filtrar por tag', () => {
    const store = useGraphStore.getState()
    const rootId = store.addRootNode('Matemática')
    store.updateNode(rootId, { tags: ['exatas'] })
    const subId = store.addSubNode(rootId, 'Topologia')
    store.setFocus(subId)

    render(<BreadcrumbsBar />)

    expect(screen.getByText('Visão geral')).toBeInTheDocument()
    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(screen.getByText('Topologia')).toBeInTheDocument()

    // Clicar em Visão geral reseta o focusId
    fireEvent.click(screen.getByText('Visão geral'))
    expect(useGraphStore.getState().focusId).toBeNull()

    // Selecionar tag no filtro rápido atualiza activeTag na store
    const tagSelect = screen.getByLabelText('Filtrar por tag') as HTMLSelectElement
    fireEvent.change(tagSelect, { target: { value: 'exatas' } })
    expect(useGraphStore.getState().activeTag).toBe('exatas')
  })

  it('deve exportar PNG 2x com skipFonts=true e bounds simétricos quando o viewport existir', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const store = useGraphStore.getState()
    store.addRootNode('Conceito Único', { x: 100, y: 100 })

    const viewportDiv = document.createElement('div')
    viewportDiv.className = 'react-flow__viewport'
    document.body.appendChild(viewportDiv)

    render(<BreadcrumbsBar />)

    const menuBtn = screen.getByRole('button', { name: /Arquivo/i })
    fireEvent.click(menuBtn)

    const pngBtn = screen.getByRole('menuitem', { name: /PNG 2x/i })
    fireEvent.click(pngBtn)

    await waitFor(() => {
      expect(toPng).toHaveBeenCalledTimes(1)
    })

    expect(toPng).toHaveBeenCalledWith(
      viewportDiv,
      expect.objectContaining({
        pixelRatio: 2,
        skipFonts: true,
        backgroundColor: '#0e111a',
      })
    )
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
    viewportDiv.remove()
  })

  it('deve alternar ciclicamente entre os 3 temas visuais ao clicar no botão de tema', () => {
    render(<BreadcrumbsBar />)

    const toggleBtn = screen.getByTestId('theme-toggle')
    expect(toggleBtn).toHaveTextContent('Escuro')
    expect(useGraphStore.getState().theme).toBe('dark')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveTextContent('Claro')
    expect(useGraphStore.getState().theme).toBe('light')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveTextContent('Papel')
    expect(useGraphStore.getState().theme).toBe('high-contrast')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveTextContent('Escuro')
    expect(useGraphStore.getState().theme).toBe('dark')
  })

  it('deve renderizar menu dropdown de arquivo com opções de importação e exportação', () => {
    render(<BreadcrumbsBar />)
    const menuBtn = screen.getByRole('button', { name: /Arquivo/i })
    expect(menuBtn).toBeInTheDocument()

    // Abre o dropdown
    fireEvent.click(menuBtn)
    expect(screen.getByRole('menuitem', { name: /Exportar PNG 2x/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Exportar JSON/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Importar \.tex/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Importar JSON/i })).toBeInTheDocument()
  })

  it('deve alternar entre Modo de Edição e Modo de Visualização ocultando botões de mutação e importação', () => {
    useGraphStore.getState().setEditorMode('edit')
    const { rerender } = render(<BreadcrumbsBar />)

    // Modo Edição ativo por padrão
    expect(screen.getByRole('button', { name: /Novo Conceito/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Organizar Mapa/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Desfazer/i })).toBeInTheDocument()

    const viewModeBtn = screen.getByTestId('mode-view')
    fireEvent.click(viewModeBtn)

    expect(useGraphStore.getState().editorMode).toBe('view')

    rerender(<BreadcrumbsBar />)

    // No modo de visualização, controles de edição ficam ocultos
    expect(screen.queryByRole('button', { name: /Novo Conceito/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Organizar Mapa/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desfazer/i })).not.toBeInTheDocument()

    // No dropdown de Arquivo em modo visualização, as opções de importação somem, mas exportação permanece
    const menuBtn = screen.getByRole('button', { name: /Arquivo/i })
    fireEvent.click(menuBtn)
    expect(screen.getByRole('menuitem', { name: /Exportar PNG 2x/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Exportar JSON/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Importar \.tex/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Importar JSON/i })).not.toBeInTheDocument()
  })

  it('deve permitir iniciar e encerrar o tour guiado pelo botão Apresentação', () => {
    const store = useGraphStore.getState()
    store.addRootNode('Conceito 1')
    render(<BreadcrumbsBar />)

    const tourBtn = screen.getByRole('button', { name: /Apresentação/i })
    expect(tourBtn).toBeInTheDocument()

    fireEvent.click(tourBtn)
    expect(useGraphStore.getState().isTourActive).toBe(true)

    expect(screen.getByRole('button', { name: /Sair do Tour/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sair do Tour/i }))
    expect(useGraphStore.getState().isTourActive).toBe(false)
  })
})
