import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsModal } from '../SettingsModal'
import { useGraphStore } from '../../core/graphStore'

describe('SettingsModal Component', () => {
  beforeEach(() => {
    localStorage.clear()
    useGraphStore.getState().resetGraph()
    useGraphStore.getState().addRootNode('Álgebra')
  })

  it('não deve renderizar quando isOpen for false', () => {
    const { container } = render(<SettingsModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('deve renderizar modal com abas quando isOpen for true', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: /configurações e backups/i })).toBeInTheDocument()
    expect(screen.getByText('Backups & Snapshots')).toBeInTheDocument()
    expect(screen.getByText('Temas & Visual')).toBeInTheDocument()
    expect(screen.getByText('Atalhos de Teclado')).toBeInTheDocument()
    expect(screen.getByText('Segurança & Local-First')).toBeInTheDocument()
    expect(screen.getByText('Zona de Perigo')).toBeInTheDocument()
  })

  it('deve renderizar a aba de atalhos diretamente quando initialTab="shortcuts"', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} initialTab="shortcuts" />)
    expect(screen.getByText('Navegação & Foco')).toBeInTheDocument()
    expect(screen.getByText('Estrutura & Nós')).toBeInTheDocument()
    expect(screen.getByText('Histórico & Sistema')).toBeInTheDocument()
  })

  it('deve permitir criar um snapshot local e exibi-lo na lista', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(/ex: antes de refatorar álgebra/i)
    fireEvent.change(input, { target: { value: 'Ponto de Teste' } })

    const saveBtn = screen.getByRole('button', { name: /salvar snapshot/i })
    fireEvent.click(saveBtn)

    expect(screen.getByText('Ponto de Teste')).toBeInTheDocument()
  })

  it('deve alternar entre as abas ao clicar', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)
    const shortcutsTabBtn = screen.getByRole('button', { name: /atalhos de teclado/i })
    fireEvent.click(shortcutsTabBtn)
    expect(screen.getByText('Navegação & Foco')).toBeInTheDocument()

    const securityTabBtn = screen.getByRole('button', { name: /segurança & local-first/i })
    fireEvent.click(securityTabBtn)

    expect(screen.getByText(/diagnóstico de privacidade/i)).toBeInTheDocument()
    expect(screen.getByText(/zero cloud & zero tracking/i)).toBeInTheDocument()
  })

  it('deve permitir alternar o tema visual exclusivamente pelo modal de configurações', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)
    const themeTabBtn = screen.getByRole('button', { name: /temas & visual/i })
    fireEvent.click(themeTabBtn)

    expect(screen.getByText(/tema escuro \(padrão\)/i)).toBeInTheDocument()
    expect(screen.getByText(/tema claro/i)).toBeInTheDocument()
    expect(screen.getByText(/alto contraste papel \/ impresso/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/tema claro/i))
    expect(useGraphStore.getState().theme).toBe('light')

    fireEvent.click(screen.getByText(/alto contraste papel \/ impresso/i))
    expect(useGraphStore.getState().theme).toBe('high-contrast')
  })

  it('deve fechar ao pressionar a tecla Escape', () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
