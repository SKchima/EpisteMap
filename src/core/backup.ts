import type { KnowledgeNode, KnowledgeEdge, Graph } from './types'
import { sanitizeGraph } from './graph'

export type LocalSnapshot = {
  id: string
  timestamp: number
  isoDate: string
  nodeCount: number
  edgeCount: number
  label: string
  graph: Graph
}

const SNAPSHOTS_KEY = 'epistemap:snapshots'
const MAX_SNAPSHOTS = 10

export function createBackupFilename(prefix = 'epistemap-backup', includePdfs = true): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = now.getFullYear()
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const hh = pad(now.getHours())
  const min = pad(now.getMinutes())
  const suffix = includePdfs ? 'full' : 'light'
  return `${prefix}-${yyyy}-${mm}-${dd}-${hh}${min}-${suffix}.json`
}

export function prepareGraphForExport(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  options: { includePdfs?: boolean } = {}
): Graph {
  const includePdfs = options.includePdfs ?? true
  if (includePdfs) {
    return { nodes, edges }
  }

  // Versão leve: remove o payload base64 dos PDFs, mantendo o nome e a página de referência
  const strippedNodes: KnowledgeNode[] = nodes.map((n) => {
    if (!n.data.pdfAttachment) return n
    return {
      ...n,
      data: {
        ...n.data,
        pdfAttachment: {
          name: n.data.pdfAttachment.name,
          base64: '', // Removido para exportação leve (<50KB)
          page: n.data.pdfAttachment.page,
          ...(n.data.pdfAttachment.filePath ? { filePath: n.data.pdfAttachment.filePath } : {}),
        },
      },
    }
  })

  return { nodes: strippedNodes, edges }
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function getLocalSnapshots(): LocalSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('Erro ao carregar snapshots locais:', err)
    return []
  }
}

export function saveLocalSnapshot(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  label = 'Snapshot Manual'
): LocalSnapshot | null {
  try {
    const snapshots = getLocalSnapshots()
    const now = new Date()
    const snapshotGraph = prepareGraphForExport(nodes, edges, { includePdfs: false }) // snapshots locais sem base64 para economizar espaço
    const newSnapshot: LocalSnapshot = {
      id: 'snap_' + Math.random().toString(36).substring(2, 9),
      timestamp: now.getTime(),
      isoDate: now.toLocaleString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      label,
      graph: snapshotGraph,
    }

    const updated = [newSnapshot, ...snapshots].slice(0, MAX_SNAPSHOTS)
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated))
    return newSnapshot
  } catch (err) {
    console.warn('Falha ao salvar snapshot local:', err)
    return null
  }
}

export function deleteLocalSnapshot(snapshotId: string): LocalSnapshot[] {
  try {
    const snapshots = getLocalSnapshots().filter((s) => s.id !== snapshotId)
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots))
    return snapshots
  } catch (err) {
    console.warn('Falha ao excluir snapshot:', err)
    return getLocalSnapshots()
  }
}

export function parseBackupFile(jsonString: string): Graph {
  const parsed = JSON.parse(jsonString)
  return sanitizeGraph(parsed)
}
