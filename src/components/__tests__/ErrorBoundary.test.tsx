import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { ErrorBoundary } from '../ErrorBoundary'

const ThrowingComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Falha simulada no componente filho')
  }
  return <div>Conteúdo Normal</div>
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renderiza o conteúdo filho quando não há erros', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Conteúdo Normal')).toBeInTheDocument()
  })

  it('captura erro do filho e renderiza tela de recuperação com detalhes', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Ocorreu um erro no Epistemap')).toBeInTheDocument()
    expect(screen.getByText(/Falha simulada no componente filho/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recarregar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Restaurar Mapa Inicial/i })).toBeInTheDocument()
  })

  it('permite acionar o reset do armazenamento local', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    const resetButton = screen.getByRole('button', { name: /Restaurar Mapa Inicial/i })
    fireEvent.click(resetButton)

    expect(removeItemSpy).toHaveBeenCalledWith('epistemap:v2')
    expect(removeItemSpy).toHaveBeenCalledWith('epistemap_state_v1')

    removeItemSpy.mockRestore()
  })
})
