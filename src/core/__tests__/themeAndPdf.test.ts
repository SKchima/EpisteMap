import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useGraphStore, getInitialTheme, applyThemeToDom } from '../graphStore'
import { sanitizeGraph } from '../graph'
import type { PdfAttachment, KnowledgeNode } from '../types'

describe('Theme and PDF Attachment Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    useGraphStore.getState().loadGraph({ nodes: [], edges: [] })
    useGraphStore.temporal.getState().clear()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  describe('Theme System', () => {
    it('retorna dark como padrão quando localStorage está vazio', () => {
      expect(getInitialTheme()).toBe('dark')
    })

    it('retorna o tema salvo no localStorage quando válido', () => {
      localStorage.setItem('epistemap:theme', 'light')
      expect(getInitialTheme()).toBe('light')

      localStorage.setItem('epistemap:theme', 'high-contrast')
      expect(getInitialTheme()).toBe('high-contrast')
    })

    it('aplica o tema ao atributo data-theme do elemento raiz do documento', () => {
      applyThemeToDom('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      applyThemeToDom('high-contrast')
      expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')

      applyThemeToDom('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('setTheme atualiza a store, persiste no localStorage e sincroniza com o DOM', () => {
      useGraphStore.getState().setTheme('light')
      expect(useGraphStore.getState().theme).toBe('light')
      expect(localStorage.getItem('epistemap:theme')).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      useGraphStore.getState().setTheme('high-contrast')
      expect(useGraphStore.getState().theme).toBe('high-contrast')
      expect(localStorage.getItem('epistemap:theme')).toBe('high-contrast')
      expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')

      useGraphStore.getState().setTheme('dark')
      expect(useGraphStore.getState().theme).toBe('dark')
      expect(localStorage.getItem('epistemap:theme')).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('PDF Attachment Management', () => {
    it('anexa documento PDF a um nó existente', () => {
      useGraphStore.getState().addRootNode('Conceito com Artigo', { x: 50, y: 50 })
      const node = useGraphStore.getState().nodes[0]
      expect(node).toBeDefined()

      const attachment: PdfAttachment = {
        name: 'analise_real.pdf',
        base64: 'JVBERi0xLjQK...',
        page: 12,
      }

      useGraphStore.getState().attachPdf(node.id, attachment)

      const updated = useGraphStore.getState().nodes.find((n) => n.id === node.id)
      expect(updated?.data.pdfAttachment).toEqual(attachment)
    })

    it('atualiza a página ativa do PDF', () => {
      useGraphStore.getState().addRootNode('Leitura', { x: 0, y: 0 })
      const node = useGraphStore.getState().nodes[0]

      useGraphStore.getState().attachPdf(node.id, {
        name: 'livro.pdf',
        base64: 'base64data',
        page: 1,
      })

      useGraphStore.getState().setPdfPage(node.id, 42)

      const updated = useGraphStore.getState().nodes.find((n) => n.id === node.id)
      expect(updated?.data.pdfAttachment?.page).toBe(42)
    })

    it('impede páginas menores que 1 ao alterar a página do PDF', () => {
      useGraphStore.getState().addRootNode('Leitura', { x: 0, y: 0 })
      const node = useGraphStore.getState().nodes[0]

      useGraphStore.getState().attachPdf(node.id, {
        name: 'livro.pdf',
        base64: 'base64data',
        page: 5,
      })

      useGraphStore.getState().setPdfPage(node.id, -3)

      const updated = useGraphStore.getState().nodes.find((n) => n.id === node.id)
      expect(updated?.data.pdfAttachment?.page).toBe(1)
    })

    it('remove o anexo PDF do nó', () => {
      useGraphStore.getState().addRootNode('Conceito Desacoplado', { x: 0, y: 0 })
      const node = useGraphStore.getState().nodes[0]

      useGraphStore.getState().attachPdf(node.id, {
        name: 'artigo.pdf',
        base64: 'base64data',
        page: 3,
      })

      expect(useGraphStore.getState().nodes[0].data.pdfAttachment).toBeDefined()

      useGraphStore.getState().removePdf(node.id)

      const updated = useGraphStore.getState().nodes.find((n) => n.id === node.id)
      expect(updated?.data.pdfAttachment).toBeUndefined()
    })

    it('sanitizeGraph preserva e normaliza anexos de PDF válidos', () => {
      const rawGraph = {
        nodes: [
          {
            id: 'n1',
            data: {
              title: 'Nó com PDF',
              pdfAttachment: {
                name: '  paper.pdf  ',
                base64: 'dados',
                page: '15',
              },
            },
          },
          {
            id: 'n2',
            data: {
              title: 'Nó com página inválida',
              pdfAttachment: {
                name: '',
                base64: 'dados',
                page: -5,
              },
            },
          },
        ],
      }

      const clean = sanitizeGraph(rawGraph)
      expect(clean.nodes[0].data.pdfAttachment).toEqual({
        name: 'paper.pdf',
        base64: 'dados',
        page: 15,
      })
      expect(clean.nodes[1].data.pdfAttachment).toEqual({
        name: 'documento.pdf',
        base64: 'dados',
        page: 1,
      })
    })
  })

  describe('Batch Import (importBatch)', () => {
    it('mescla novos nós calculando layout sem sobreposição', () => {
      useGraphStore.getState().addRootNode('Nó Existente', { x: 100, y: 100 })

      const newNodes: KnowledgeNode[] = [
        {
          id: 'imported_root',
          parentId: null,
          position: { x: 100, y: 100 },
          data: {
            title: 'Seção Importada',
            description: '',
            tags: ['latex'],
            color: '#6366f1',
            collapsed: false,
          },
        },
      ]

      useGraphStore.getState().importBatch(newNodes, [])

      const nodes = useGraphStore.getState().nodes
      expect(nodes.length).toBe(2)

      const existingNode = nodes.find((n) => n.id !== 'imported_root')
      const importedNode = nodes.find((n) => n.id === 'imported_root')
      expect(existingNode).toBeDefined()
      expect(importedNode).toBeDefined()
      // Garante que ambos receberam posições válidas e não estão colidindo na mesma coordenada exata
      expect(importedNode!.position).not.toEqual(existingNode!.position)
    })

    it('permite desfazer e refazer o lote importado via undo/redo', () => {
      useGraphStore.getState().addRootNode('Base', { x: 0, y: 0 })
      useGraphStore.temporal.getState().clear()

      const newNodes: KnowledgeNode[] = [
        {
          id: 'imp_1',
          parentId: null,
          position: { x: 200, y: 200 },
          data: {
            title: 'Importado',
            description: '',
            tags: [],
            color: null,
            collapsed: false,
          },
        },
      ]

      useGraphStore.getState().importBatch(newNodes, [])
      expect(useGraphStore.getState().nodes.length).toBe(2)

      useGraphStore.getState().undo()
      expect(useGraphStore.getState().nodes.length).toBe(1)

      useGraphStore.getState().redo()
      expect(useGraphStore.getState().nodes.length).toBe(2)
    })

    it('reseta focusId para null ao importar lote garantindo visibilidade do grafo', () => {
      const store = useGraphStore.getState()
      const rootId = store.addRootNode('Conceito Base', { x: 0, y: 0 })
      const subId = store.addSubNode(rootId, 'Sub-objeto Focado')
      store.setFocus(subId)
      expect(useGraphStore.getState().focusId).toBe(subId)

      const batchNodes: KnowledgeNode[] = [
        {
          id: 'batch_root',
          parentId: null,
          position: { x: 200, y: 200 },
          data: {
            title: 'Novo Conceito do Lote',
            description: '',
            tags: [],
            color: null,
            collapsed: false,
          },
        },
      ]

      store.importBatch(batchNodes, [])
      expect(useGraphStore.getState().focusId).toBeNull()
      expect(useGraphStore.getState().nodes.some((n) => n.id === 'batch_root')).toBe(true)
    })
  })

  describe('Handle Ergonomics & Visual Contrast Rules', () => {
    it('suporta ciclo completo de temas (dark -> light -> high-contrast -> dark)', () => {
      expect(useGraphStore.getState().theme).toBe('dark')

      useGraphStore.getState().setTheme('light')
      expect(useGraphStore.getState().theme).toBe('light')
      expect(localStorage.getItem('epistemap:theme')).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      useGraphStore.getState().setTheme('high-contrast')
      expect(useGraphStore.getState().theme).toBe('high-contrast')
      expect(localStorage.getItem('epistemap:theme')).toBe('high-contrast')
      expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')

      useGraphStore.getState().setTheme('dark')
      expect(useGraphStore.getState().theme).toBe('dark')
      expect(localStorage.getItem('epistemap:theme')).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })
})
