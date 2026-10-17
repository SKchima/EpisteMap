import { describe, it, expect, beforeEach } from 'vitest'
import {
  createBackupFilename,
  prepareGraphForExport,
  getLocalSnapshots,
  saveLocalSnapshot,
  deleteLocalSnapshot,
  parseBackupFile,
} from '../backup'
import type { KnowledgeNode, KnowledgeEdge } from '../types'

describe('Epistemap Backup & Snapshot Engine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const mockNodes: KnowledgeNode[] = [
    {
      id: 'node_1',
      parentId: null,
      position: { x: 10, y: 20 },
      data: {
        title: 'Teoria da Informação',
        description: 'Claude Shannon, 1948',
        tags: ['ciência', 'computação'],
        color: '#6366f1',
        collapsed: false,
        pdfAttachment: {
          name: 'shannon1948.pdf',
          base64: 'JVBERi0xLjQKJcTl8uXr...', // heavy payload
          page: 5,
        },
      },
    },
  ]

  const mockEdges: KnowledgeEdge[] = [
    {
      id: 'edge_1',
      source: 'node_1',
      target: 'node_2',
      label: 'relaciona',
    },
  ]

  it('deve gerar nomes de arquivo com timestamp e sufixo de tipo', () => {
    const fullFilename = createBackupFilename('epistemap-backup', true)
    const lightFilename = createBackupFilename('epistemap-backup', false)

    expect(fullFilename).toMatch(/^epistemap-backup-\d{4}-\d{2}-\d{2}-\d{4}-full\.json$/)
    expect(lightFilename).toMatch(/^epistemap-backup-\d{4}-\d{2}-\d{2}-\d{4}-light\.json$/)
  })

  it('deve preservar PDFs na exportação completa', () => {
    const exported = prepareGraphForExport(mockNodes, mockEdges, { includePdfs: true })
    expect(exported.nodes[0].data.pdfAttachment?.base64).toBe('JVBERi0xLjQKJcTl8uXr...')
    expect(exported.edges).toHaveLength(1)
  })

  it('deve esvaziar o payload Base64 na exportação leve (perfeito para git em ygg)', () => {
    const exported = prepareGraphForExport(mockNodes, mockEdges, { includePdfs: false })
    expect(exported.nodes[0].data.pdfAttachment?.name).toBe('shannon1948.pdf')
    expect(exported.nodes[0].data.pdfAttachment?.page).toBe(5)
    expect(exported.nodes[0].data.pdfAttachment?.base64).toBe('')
  })

  it('deve salvar e listar snapshots locais no localStorage', () => {
    expect(getLocalSnapshots()).toHaveLength(0)

    const snap = saveLocalSnapshot(mockNodes, mockEdges, 'Antes de importar compêndio')
    expect(snap).not.toBeNull()
    expect(snap?.label).toBe('Antes de importar compêndio')

    const snapshots = getLocalSnapshots()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].nodeCount).toBe(1)
    expect(snapshots[0].graph.nodes[0].data.title).toBe('Teoria da Informação')
  })

  it('deve excluir snapshot local por id', () => {
    const snap1 = saveLocalSnapshot(mockNodes, mockEdges, 'Snap 1')
    saveLocalSnapshot(mockNodes, mockEdges, 'Snap 2')
    expect(getLocalSnapshots()).toHaveLength(2)

    deleteLocalSnapshot(snap1!.id)
    const remaining = getLocalSnapshots()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].label).toBe('Snap 2')
  })

  it('parseBackupFile deve validar e sanitizar arquivos de backup', () => {
    const jsonStr = JSON.stringify({
      nodes: [{ id: 'a', data: { title: 'Alfa' } }],
      edges: [],
    })
    const graph = parseBackupFile(jsonStr)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].data.title).toBe('Alfa')
  })
})
