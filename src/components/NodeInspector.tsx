import React, { useState } from 'react'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import {
  X,
  Trash2,
  Plus,
  Eye,
  FileText,
  Code,
  Tag,
  FolderTree,
  ExternalLink,
  Palette,
  Link as LinkIcon,
  GitBranch,
  AlertTriangle,
  ArrowRight,
  Paperclip,
} from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { getBacklinks, findNodeByTitle, canReparent, getSubtreeIds } from '../core/graph'
import { PdfViewerPanel } from './PdfViewerPanel'

function base64ToPdfBlobUrl(base64Data: string): string {
  try {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const byteCharacters = atob(cleanBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(blob)
    }
    return base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`
  } catch {
    return base64Data.startsWith('data:') ? base64Data : `data:application/pdf;base64,${base64Data}`
  }
}

const COLOR_PALETTE = [
  { name: 'Padrão', value: null },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Âmbar', value: '#f59e0b' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Roxo', value: '#a855f7' },
]

export interface NodeInspectorProps {
  onNavigate?: (nodeId: string) => void
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ onNavigate }) => {
  const selectedId = useGraphStore((s) => s.selectedId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const theme = useGraphStore((s) => s.theme)
  const select = useGraphStore((s) => s.select)
  const updateNode = useGraphStore((s) => s.updateNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const addSubNode = useGraphStore((s) => s.addSubNode)
  const reparentNode = useGraphStore((s) => s.reparentNode)
  const setFocus = useGraphStore((s) => s.setFocus)
  const navigateToNode = useGraphStore((s) => s.navigateToNode)
  const createNodeFromWikiLink = useGraphStore((s) => s.createNodeFromWikiLink)
  const updateEdgeLabel = useGraphStore((s) => s.updateEdgeLabel)
  const removeEdge = useGraphStore((s) => s.removeEdge)
  const attachPdf = useGraphStore((s) => s.attachPdf)
  const removePdf = useGraphStore((s) => s.removePdf)
  const setPdfPage = useGraphStore((s) => s.setPdfPage)

  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')
  const [activeInspectorView, setActiveInspectorView] = useState<'details' | 'pdf'>('details')
  const [editingTag, setEditingTag] = useState<{ nodeId: string; value: string } | null>(null)
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null)

  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const asideBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#151821'
  const asideBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #e2e8f0' : '1px solid #262b3a'
  const textColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isHighContrast ? '#000000' : isLight ? '#475569' : '#94a3b8'
  const inputBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#1e2330'
  const inputBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #333d52'
  const sectionBg = isHighContrast ? '#ffffff' : isLight ? '#f8fafc' : '#1c202d'
  const sectionBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #e2e8f0' : '1px solid #2a3142'
  const btnBg = isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#1e2433'
  const btnBorder = isHighContrast ? '1.5px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #2e364f'

  const handleNavigate = (targetId: string) => {
    navigateToNode(targetId)
    onNavigate?.(targetId)
  }

  const handleCreateWikiLink = (sourceId: string, title: string) => {
    const targetId = createNodeFromWikiLink(sourceId, title)
    if (targetId) {
      onNavigate?.(targetId)
    }
    return targetId
  }

  const selectedNode = nodes.find((n) => n.id === selectedId)
  const selectedEdge = !selectedNode ? edges.find((e) => e.id === selectedId) : undefined

  // Caso uma aresta esteja selecionada, exibe o Inspetor de Relação Semântica
  if (selectedEdge) {
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source)
    const targetNode = nodes.find((n) => n.id === selectedEdge.target)

    return (
      <aside
        style={{
          width: '360px',
          background: asideBg,
          borderLeft: asideBorder,
          color: textColor,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 52px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: asideBorder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LinkIcon size={13} color={isHighContrast ? '#000000' : '#38bdf8'} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: isHighContrast ? '#000000' : '#38bdf8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Relação Semântica (Aresta)
            </span>
          </div>
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Fechar inspetor"
            style={{
              background: 'transparent',
              border: 'none',
              color: textMuted,
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: sectionBg,
              borderRadius: '6px',
              padding: '12px',
              border: sectionBorder,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => sourceNode && handleNavigate(sourceNode.id)}
              style={{
                background: btnBg,
                border: btnBorder,
                borderRadius: '4px',
                color: textColor,
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sourceNode?.data.title || selectedEdge.source}
            </button>
            <ArrowRight size={15} color={isHighContrast ? '#000000' : '#64748b'} />
            <button
              type="button"
              onClick={() => targetNode && handleNavigate(targetNode.id)}
              style={{
                background: btnBg,
                border: btnBorder,
                borderRadius: '4px',
                color: textColor,
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {targetNode?.data.title || selectedEdge.target}
            </button>
          </div>

          <div>
            <label
              htmlFor="edge-label-input"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: textMuted,
                marginBottom: '6px',
              }}
            >
              RÓTULO DA RELAÇÃO
            </label>
            <input
              id="edge-label-input"
              type="text"
              value={selectedEdge.label}
              onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)}
              placeholder="ex: fundamenta, generaliza, implica..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: inputBg,
                border: inputBorder,
                color: textColor,
                borderRadius: '5px',
                padding: '8px 10px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ paddingTop: '8px', borderTop: asideBorder }}>
            <button
              type="button"
              onClick={() => removeEdge(selectedEdge.id)}
              style={{
                width: '100%',
                background: isHighContrast ? '#ffffff' : '#2f1f24',
                border: isHighContrast ? '2px solid #000000' : '1px solid #5a2e38',
                color: isHighContrast ? '#000000' : '#f87171',
                borderRadius: '5px',
                padding: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 500,
              }}
            >
              <Trash2 size={14} /> Excluir Relação
            </button>
          </div>
        </div>
      </aside>
    )
  }

  if (!selectedNode) {
    return (
      <aside
        style={{
          width: '340px',
          background: asideBg,
          borderLeft: asideBorder,
          padding: '20px',
          color: textMuted,
          fontSize: '13px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '14px',
              color: textColor,
              marginTop: 0,
              marginBottom: '12px',
              fontWeight: 600,
            }}
          >
            Inspetor de Conhecimento
          </h3>
          <p style={{ lineHeight: 1.5, marginBottom: '16px' }}>
            Selecione qualquer conceito ou aresta no mapa para visualizar e editar sua estrutura interna, sub-objetos e equações.
          </p>

          <div
            style={{
              background: sectionBg,
              borderRadius: '6px',
              border: sectionBorder,
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontWeight: 600, color: textColor, marginBottom: '8px', fontSize: '12px' }}>
              Estatísticas do Grafo
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Conceitos Totais:</span>
              <strong style={{ color: textColor }}>{nodes.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Conceitos Raiz:</span>
              <strong style={{ color: textColor }}>
                {nodes.filter((n) => n.parentId === null).length}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Sub-objetos:</span>
              <strong style={{ color: textColor }}>
                {nodes.filter((n) => n.parentId !== null).length}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Relações e Conexões:</span>
              <strong style={{ color: textColor }}>{edges.length}</strong>
            </div>
          </div>

          <div style={{ background: sectionBg, border: sectionBorder, borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontWeight: 600, color: textColor, marginBottom: '8px', fontSize: '12px' }}>
              Atalhos e Dicas
            </div>
            <ul style={{ paddingLeft: '16px', margin: 0, lineHeight: 1.65, fontSize: '12px' }}>
              <li>
                <code>⌘K</code> / <code>Ctrl+K</code>: Busca global inteligente com expansão automática.
              </li>
              <li>
                <code>⌘Z</code> / <code>⌘⇧Z</code>: Desfazer e refazer alterações no grafo.
              </li>
              <li>
                <code>Tab</code> / <code>Enter</code>: Criar sub-objeto ou conceito irmão.
              </li>
              <li>
                Use <code>[[Novo Conceito]]</code> na descrição para criar links ou novos nós com 1 clique.
              </li>
              <li>
                Fórmulas LaTeX: <code>$E=mc^2$</code> ou <code>$$\int f(x)dx$$</code>.
              </li>
            </ul>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          EpisteMap • Modelagem de Conhecimento
        </div>
      </aside>
    )
  }

  const childNodes = nodes.filter((n) => n.parentId === selectedNode.id)
  const backlinks = getBacklinks(nodes, selectedNode.id)
  const validParents = nodes.filter((n) => canReparent(nodes, selectedNode.id, n.id))
  const subtreeCount = getSubtreeIds(nodes, selectedNode.id).size - 1
  const isConfirmingDelete = confirmDeleteNodeId === selectedNode.id

  const tagInput =
    editingTag?.nodeId === selectedNode.id
      ? editingTag.value
      : selectedNode.data.tags.join(', ')

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(selectedNode.id, { title: e.target.value })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNode(selectedNode.id, { description: e.target.value })
  }

  const commitTags = (rawValue: string) => {
    const tags = rawValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    updateNode(selectedNode.id, { tags })
    setEditingTag(null)
  }

  const handleTagBlur = () => {
    if (editingTag?.nodeId === selectedNode.id) {
      commitTags(editingTag.value)
    }
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && editingTag?.nodeId === selectedNode.id) {
      e.preventDefault()
      commitTags(editingTag.value)
    }
  }

  const handleColorSelect = (color: string | null) => {
    updateNode(selectedNode.id, { color })
  }

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParentId = e.target.value || null
    reparentNode(selectedNode.id, newParentId)
  }

  const handleAddChild = () => {
    addSubNode(selectedNode.id)
  }

  const handleDrillDown = () => {
    setFocus(selectedNode.id)
  }

  const handleConfirmDelete = () => {
    setConfirmDeleteNodeId(null)
    removeNode(selectedNode.id)
  }

  const handleAttachPdfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedNode) return

    if (file.size > 15 * 1024 * 1024) {
      alert(
        'O arquivo PDF selecionado excede 15MB. Para garantir boa performance e portabilidade no navegador, use arquivos de até 15MB.'
      )
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      if (base64) {
        attachPdf(selectedNode.id, {
          name: file.name,
          base64,
          page: 1,
        })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleOpenExternalPdf = () => {
    if (!selectedNode?.data.pdfAttachment?.base64) return
    const blobUrl = base64ToPdfBlobUrl(selectedNode.data.pdfAttachment.base64)
    const pageNum = selectedNode.data.pdfAttachment.page || 1
    window.open(`${blobUrl}#page=${pageNum}`, '_blank')
  }

  const isViewingPdf = activeInspectorView === 'pdf' && Boolean(selectedNode.data.pdfAttachment)

  return (
    <aside
      style={{
        width: isViewingPdf ? '540px' : '380px',
        background: asideBg,
        borderLeft: asideBorder,
        color: textColor,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        overflowY: isViewingPdf ? 'hidden' : 'auto',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Topo do Inspetor */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: asideBorder,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#181b26',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: isHighContrast ? '#000000' : selectedNode.data.color || '#6366f1',
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: isHighContrast ? '#000000' : '#818cf8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {selectedNode.parentId ? 'Sub-objeto' : 'Conceito Raiz'}
            </span>
          </div>

          {selectedNode.data.pdfAttachment && (
            <div style={{ display: 'flex', gap: '2px', marginLeft: '6px' }}>
              <button
                type="button"
                onClick={() => setActiveInspectorView('details')}
                style={{
                  background: !isViewingPdf ? (isHighContrast ? '#000000' : '#4f46e5') : btnBg,
                  color: !isViewingPdf ? '#ffffff' : textColor,
                  border: btnBorder,
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Detalhes
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorView('pdf')}
                style={{
                  background: isViewingPdf ? (isHighContrast ? '#000000' : '#4f46e5') : btnBg,
                  color: isViewingPdf ? '#ffffff' : textColor,
                  border: btnBorder,
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <FileText size={10} />
                <span>PDF (p.{selectedNode.data.pdfAttachment.page || 1})</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleDrillDown}
            title="Drill-down (Focar neste nó)"
            style={{
              background: btnBg,
              border: btnBorder,
              color: isHighContrast ? '#000000' : '#38bdf8',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Eye size={12} />
            Focar
          </button>
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Fechar inspetor"
            style={{
              background: 'transparent',
              border: 'none',
              color: textMuted,
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {isViewingPdf && selectedNode.data.pdfAttachment ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <PdfViewerPanel
            attachment={selectedNode.data.pdfAttachment}
            onUpdatePage={(p) => setPdfPage(selectedNode.id, p)}
            onRemove={() => {
              removePdf(selectedNode.id)
              setActiveInspectorView('details')
            }}
            onClose={() => setActiveInspectorView('details')}
          />
        </div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Título */}
          <div>
            <label
              htmlFor="node-title-input"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: textMuted,
                marginBottom: '6px',
              }}
            >
              TÍTULO DO CONCEITO
            </label>
            <input
              id="node-title-input"
              type="text"
              value={selectedNode.data.title}
              onChange={handleTitleChange}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: inputBg,
                border: inputBorder,
                color: textColor,
                borderRadius: '5px',
                padding: '8px 10px',
                fontSize: '14px',
                fontWeight: 500,
                outline: 'none',
              }}
            />
          </div>

          {/* Seletor de Nó Pai (Reparenting Alternativo) */}
          <div>
            <label
              htmlFor="parent-node-select"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: textMuted,
                marginBottom: '6px',
              }}
            >
              <GitBranch size={12} /> HIERARQUIA (NÓ PAI)
            </label>
            <select
              id="parent-node-select"
              aria-label="Nó Pai"
              value={selectedNode.parentId || ''}
              onChange={handleParentChange}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: inputBg,
                border: inputBorder,
                color: textColor,
                borderRadius: '5px',
                padding: '7px 10px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: inputBg, color: textColor }}>
                — Conceito Raiz (Sem pai) —
              </option>
              {validParents.map((p) => (
                <option key={p.id} value={p.id} style={{ background: inputBg, color: textColor }}>
                  {p.data.title}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Cores */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: textMuted,
                marginBottom: '6px',
              }}
            >
              <Palette size={12} /> COR TEMÁTICA
            </label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {COLOR_PALETTE.map((c, idx) => {
                const isSelected = selectedNode.data.color === c.value
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleColorSelect(c.value)}
                    title={c.name}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '4px',
                      border: isSelected
                        ? isHighContrast
                          ? '2px solid #000'
                          : '2px solid #fff'
                        : isHighContrast
                          ? '1px solid #000'
                          : '1px solid #333d52',
                      backgroundColor: c.value || (isHighContrast ? '#ffffff' : '#334155'),
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 6px rgba(255,255,255,0.6)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Tags sem cascata de useEffect */}
          <div>
            <label
              htmlFor="node-tags-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: textMuted,
                marginBottom: '6px',
              }}
            >
              <Tag size={12} /> TAGS (SEPARADAS POR VÍRGULA)
            </label>
            <input
              id="node-tags-input"
              type="text"
              value={tagInput}
              onChange={(e) =>
                setEditingTag({ nodeId: selectedNode.id, value: e.target.value })
              }
              onBlur={handleTagBlur}
              onKeyDown={handleTagKeyDown}
              placeholder="ex: álgebra, cálculo, fundamentos"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: inputBg,
                border: inputBorder,
                color: textColor,
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Documento PDF Acoplado */}
          <div
            style={{
              background: sectionBg,
              borderRadius: '6px',
              padding: '12px',
              border: sectionBorder,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: selectedNode.data.pdfAttachment ? '10px' : '0',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                <Paperclip size={12} /> DOCUMENTO PDF ACOPLADO
              </span>

              {selectedNode.data.pdfAttachment && (
                <button
                  type="button"
                  onClick={() => setActiveInspectorView('pdf')}
                  style={{
                    background: isHighContrast ? '#000000' : '#4f46e5',
                    border: isHighContrast ? '2px solid #000000' : 'none',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Eye size={11} /> Ver PDF
                </button>
              )}
            </div>

            {!selectedNode.data.pdfAttachment ? (
              <div style={{ marginTop: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: inputBg,
                    border: isHighContrast ? '2px dashed #000000' : isLight ? '1.5px dashed #cbd5e1' : '1.5px dashed #3b4259',
                    borderRadius: '5px',
                    padding: '10px',
                    color: textMuted,
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <Plus size={13} />
                  <span>Anexar Arquivo PDF (.pdf)</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleAttachPdfFile}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: inputBg,
                    border: inputBorder,
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileText size={13} color={isHighContrast ? '#000000' : '#818cf8'} />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '180px',
                        color: textColor,
                        fontWeight: 500,
                      }}
                      title={selectedNode.data.pdfAttachment.name}
                    >
                      {selectedNode.data.pdfAttachment.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: textMuted }}>Pág:</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedNode.data.pdfAttachment.page || 1}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                        setPdfPage(selectedNode.id, val)
                      }}
                      aria-label="Página de referência do PDF"
                      style={{
                        width: '40px',
                        background: inputBg,
                        border: inputBorder,
                        color: textColor,
                        borderRadius: '3px',
                        padding: '2px 4px',
                        fontSize: '11px',
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveInspectorView('pdf')}
                    style={{
                      flex: 1,
                      background: isHighContrast ? '#000000' : '#4f46e5',
                      border: isHighContrast ? '2px solid #000000' : 'none',
                      color: '#ffffff',
                      borderRadius: '4px',
                      padding: '6px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <Eye size={12} /> Abrir no Leitor Embutido
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenExternalPdf}
                    title="Abrir no leitor de PDF do sistema (Zathura)"
                    style={{
                      background: btnBg,
                      border: btnBorder,
                      color: textColor,
                      borderRadius: '4px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ExternalLink size={12} /> Zathura
                  </button>

                  <button
                    type="button"
                    onClick={() => removePdf(selectedNode.id)}
                    title="Remover PDF acoplado"
                    aria-label="Remover PDF"
                    style={{
                      background: isHighContrast ? '#ffffff' : '#2f1f24',
                      border: isHighContrast ? '1.5px solid #000' : '1px solid #5a2e38',
                      color: isHighContrast ? '#000' : '#f87171',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-objetos */}
          <div
            style={{
              background: sectionBg,
              borderRadius: '6px',
              padding: '12px',
              border: sectionBorder,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: textColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FolderTree size={14} color={isHighContrast ? '#000000' : '#818cf8'} /> Sub-objetos ({childNodes.length})
              </span>
              <button
                type="button"
                onClick={handleAddChild}
                style={{
                  background: isHighContrast ? '#000000' : '#4f46e5',
                  border: isHighContrast ? '1.5px solid #000000' : 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            {childNodes.length === 0 ? (
              <div style={{ fontSize: '11px', color: textMuted, fontStyle: 'italic', padding: '4px 0' }}>
                Nenhum sub-objeto ainda. Clique em "Adicionar" para subdividir este conceito.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {childNodes.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => handleNavigate(child.id)}
                    style={{
                      background: btnBg,
                      border: btnBorder,
                      padding: '6px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: textColor,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {child.data.title}
                    </span>
                    <ExternalLink size={12} color={textMuted} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backlinks / Menções Semânticas */}
          {backlinks.length > 0 && (
            <div
              style={{
                background: sectionBg,
                borderRadius: '6px',
                padding: '12px',
                border: sectionBorder,
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: textColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                <LinkIcon size={13} color={isHighContrast ? '#000000' : '#38bdf8'} /> Referenciado por ({backlinks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {backlinks.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleNavigate(b.id)}
                    style={{
                      background: btnBg,
                      border: btnBorder,
                      padding: '5px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: isHighContrast ? '#000000' : '#38bdf8',
                      cursor: 'pointer',
                    }}
                  >
                    [[{b.data.title}]]
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição Markdown + LaTeX com Links Interativos e Red Links */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <label style={{ fontSize: '11px', fontWeight: 600, color: textMuted }}>
                DESCRIÇÃO CIENTÍFICA (MARKDOWN & LATEX)
              </label>
              <div style={{ display: 'flex', background: btnBg, border: btnBorder, borderRadius: '4px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  style={{
                    background: activeTab === 'preview' ? (isHighContrast ? '#000' : '#2e3547') : 'transparent',
                    border: 'none',
                    color: activeTab === 'preview' ? '#ffffff' : textMuted,
                    borderRadius: '3px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <FileText size={12} /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  style={{
                    background: activeTab === 'edit' ? (isHighContrast ? '#000' : '#2e3547') : 'transparent',
                    border: 'none',
                    color: activeTab === 'edit' ? '#ffffff' : textMuted,
                    borderRadius: '3px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Code size={12} /> Editar
                </button>
              </div>
            </div>

            {activeTab === 'edit' ? (
              <textarea
                value={selectedNode.data.description}
                onChange={handleDescriptionChange}
                placeholder="Digite em Markdown... Equações LaTeX: $E=mc^2$ ou $$\int_a^b f(x)dx$$. Links para outros nós: [[Nome]]"
                rows={11}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: inputBg,
                  border: inputBorder,
                  color: textColor,
                  borderRadius: '5px',
                  padding: '10px',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, monospace',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            ) : (
              <div
                style={{
                  minHeight: '140px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: inputBg,
                  border: inputBorder,
                  borderRadius: '5px',
                  padding: '12px',
                  color: textColor,
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                {selectedNode.data.description ? (
                  <Markdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => (
                        <p style={{ margin: '0 0 8px 0' }}>
                          {renderWithWikiLinks(
                            children,
                            nodes,
                            selectedNode.id,
                            handleNavigate,
                            handleCreateWikiLink
                          )}
                        </p>
                      ),
                      li: ({ children }) => (
                        <li>
                          {renderWithWikiLinks(
                            children,
                            nodes,
                            selectedNode.id,
                            handleNavigate,
                            handleCreateWikiLink
                          )}
                        </li>
                      ),
                    }}
                  >
                    {selectedNode.data.description}
                  </Markdown>
                ) : (
                  <span style={{ color: textMuted, fontStyle: 'italic', fontSize: '12px' }}>
                    Nenhuma descrição preenchida. Mude para a aba "Editar" para adicionar texto e fórmulas.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Excluir Nó com Modal Dark de Confirmação */}
          <div style={{ paddingTop: '8px', borderTop: asideBorder }}>
            {!isConfirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteNodeId(selectedNode.id)}
                style={{
                  width: '100%',
                  background: isHighContrast ? '#ffffff' : '#2f1f24',
                  border: isHighContrast ? '2px solid #000000' : '1px solid #5a2e38',
                  color: isHighContrast ? '#000000' : '#f87171',
                  borderRadius: '5px',
                  padding: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 500,
                }}
              >
                <Trash2 size={14} /> Excluir Nó e Sub-objetos
              </button>
            ) : (
              <div
                role="alertdialog"
                aria-label="Confirmação de exclusão"
                style={{
                  background: isHighContrast ? '#ffffff' : '#23171d',
                  border: isHighContrast ? '2px solid #000000' : '1px solid #7f1d1d',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: isHighContrast ? '#000000' : '#fca5a5', fontSize: '12px', lineHeight: 1.45 }}>
                  <AlertTriangle size={16} color={isHighContrast ? '#000000' : '#f87171'} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>
                    Tem certeza que deseja excluir <strong>"{selectedNode.data.title}"</strong>
                    {subtreeCount > 0
                      ? ` e todos os seus ${subtreeCount} sub-objeto(s) descendentes?`
                      : '?'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteNodeId(null)}
                    style={{
                      background: btnBg,
                      border: btnBorder,
                      color: textColor,
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    style={{
                      background: isHighContrast ? '#000000' : '#dc2626',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

// Utilitário para transformar [[Nome]] em links clicáveis (azuis se existirem, Red Links âmbar/vermelhos com + se não existirem)
function renderWithWikiLinks(
  children: React.ReactNode,
  nodes: ReturnType<typeof useGraphStore.getState>['nodes'],
  sourceNodeId: string,
  navigateToNode: (id: string) => void,
  createNodeFromWikiLink: (sourceId: string, title: string) => string
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(/(\[\[.*?\]\])/g)
      return parts.map((part, i) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const title = part.slice(2, -2).trim()
          if (!title) return part

          const found = findNodeByTitle(nodes, title)
          if (found) {
            return (
              <button
                type="button"
                key={i}
                onClick={() => navigateToNode(found.id)}
                title={`Navegar para "${found.data.title}"`}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  margin: '0 2px',
                }}
              >
                {title}
              </button>
            )
          }

          // Red Link: Conceito ainda não existe — cria com 1 clique
          return (
            <button
              type="button"
              key={i}
              onClick={() => createNodeFromWikiLink(sourceNodeId, title)}
              title={`Criar conceito "${title}" e conectar`}
              style={{
                background: 'rgba(245, 158, 11, 0.14)',
                border: '1px dashed #f59e0b',
                color: '#fbbf24',
                borderRadius: '3px',
                padding: '1px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                margin: '0 2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Plus size={10} />
              <span>{title}</span>
            </button>
          )
        }
        return part
      })
    }

    if (
      React.isValidElement<{ children?: React.ReactNode; className?: string }>(child) &&
      typeof child.type === 'string' &&
      child.type !== 'code' &&
      child.type !== 'pre' &&
      !child.props.className?.includes('katex') &&
      child.props.children !== undefined
    ) {
      return React.cloneElement(
        child,
        undefined,
        renderWithWikiLinks(
          child.props.children,
          nodes,
          sourceNodeId,
          navigateToNode,
          createNodeFromWikiLink
        )
      )
    }

    return child
  })
}
