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
})
