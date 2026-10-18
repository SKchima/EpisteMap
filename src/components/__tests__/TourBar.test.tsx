import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourBar } from '../TourBar'
import { useGraphStore } from '../../core/graphStore'

describe('TourBar (Modo Apresentação / Trilha Guiada)', () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph()
    useGraphStore.getState().endTour()
  })

  it('não deve renderizar quando o tour estiver inativo', () => {
    const { container } = render(<TourBar />)
    expect(container.firstChild).toBeNull()
  })

  it('deve renderizar controles de passo e título do conceito quando tour estiver ativo', () => {
    const store = useGraphStore.getState()
    const idA = store.addRootNode('Axioma 1', { x: 0, y: 0 })
    const idB = store.addRootNode('Teorema 1', { x: 200, y: 0 })
    store.addEdge(idA, idB)

    store.startTour()

    const onStepChange = vi.fn()
    render(<TourBar onStepChange={onStepChange} />)

    expect(screen.getByRole('region', { name: 'Controles da Trilha Guiada' })).toBeInTheDocument()
    expect(screen.getByText(/Passo 1 de 2/i)).toBeInTheDocument()
    expect(screen.getByText('Axioma 1')).toBeInTheDocument()
    expect(onStepChange).toHaveBeenCalledWith(idA)
  })

  it('deve avançar e retroceder passos ao clicar nos botões ou usar setas do teclado', () => {
    const store = useGraphStore.getState()
    const idA = store.addRootNode('Definição', { x: 0, y: 0 })
    const idB = store.addRootNode('Lema', { x: 100, y: 0 })
    const idC = store.addRootNode('Teorema', { x: 200, y: 0 })
    store.addEdge(idA, idB)
    store.addEdge(idB, idC)

    store.startTour()

    render(<TourBar />)

    expect(screen.getByText(/Passo 1 de 3/i)).toBeInTheDocument()

    // Avança para o próximo passo
    const nextBtn = screen.getByRole('button', { name: 'Próximo Conceito' })
    fireEvent.click(nextBtn)

    expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument()
    expect(screen.getByText('Lema')).toBeInTheDocument()

    // Avança via tecla ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/Passo 3 de 3/i)).toBeInTheDocument()
    expect(screen.getByText('Teorema')).toBeInTheDocument()

    // Retrocede via tecla ArrowLeft
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/Passo 2 de 3/i)).toBeInTheDocument()
    expect(screen.getByText('Lema')).toBeInTheDocument()
  })

  it('deve encerrar o tour ao clicar no botão fechar ou pressionar Escape', () => {
    const store = useGraphStore.getState()
    store.addRootNode('Conceito Único')
    store.startTour()

    render(<TourBar />)

    expect(screen.getByRole('region', { name: 'Controles da Trilha Guiada' })).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'Encerrar Trilha Guiada' })
    fireEvent.click(closeBtn)

    expect(useGraphStore.getState().isTourActive).toBe(false)
  })
})
