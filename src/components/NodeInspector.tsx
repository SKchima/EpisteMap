import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { getBacklinks, findNodeByTitle } from '../core/graph'

const COLOR_PALETTE = [
  { name: 'Padrão', value: null },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Âmbar', value: '#f59e0b' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Roxo', value: '#a855f7' },
]

export const NodeInspector: React.FC = () => {
  const selectedId = useGraphStore((s) => s.selectedId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const select = useGraphStore((s) => s.select)
  const updateNode = useGraphStore((s) => s.updateNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const addSubNode = useGraphStore((s) => s.addSubNode)
  const setFocus = useGraphStore((s) => s.setFocus)

  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')
  const [tagInput, setTagInput] = useState('')

  const selectedNode = nodes.find((n) => n.id === selectedId)
  const childNodes = nodes.filter((n) => n.parentId === selectedId)
  const backlinks = selectedNode ? getBacklinks(nodes, selectedNode.id) : []

  // Sincroniza o input local de tags apenas quando o nó selecionado mudar
  useEffect(() => {
    if (selectedNode) {
      setTagInput(selectedNode.data.tags.join(', '))
    }
  }, [selectedNode?.id])

  if (!selectedNode) {
    return (
      <aside
        style={{
          width: '340px',
          background: '#151821',
          borderLeft: '1px solid #262b3a',
          padding: '20px',
          color: '#94a3b8',
          fontSize: '13px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3 style={{ fontSize: '14px', color: '#f1f5f9', marginTop: 0, marginBottom: '12px', fontWeight: 600 }}>
            Inspetor de Conhecimento
          </h3>
          <p style={{ lineHeight: 1.5, marginBottom: '16px' }}>
            Selecione qualquer conceito no mapa para visualizar e editar sua estrutura interna, sub-objetos e equações.
          </p>

          <div style={{ background: '#1c202d', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '8px', fontSize: '12px' }}>
              Estatísticas do Grafo
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Conceitos Totais:</span>
              <strong style={{ color: '#cbd5e1' }}>{nodes.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Conceitos Raiz:</span>
              <strong style={{ color: '#cbd5e1' }}>{nodes.filter((n) => n.parentId === null).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Sub-objetos:</span>
              <strong style={{ color: '#cbd5e1' }}>{nodes.filter((n) => n.parentId !== null).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Relações e Conexões:</span>
              <strong style={{ color: '#cbd5e1' }}>{edges.length}</strong>
            </div>
          </div>

          <div style={{ background: '#1c202d', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '8px', fontSize: '12px' }}>
              Dicas de Interação
            </div>
            <ul style={{ paddingLeft: '16px', margin: 0, lineHeight: 1.6, fontSize: '12px' }}>
              <li>Clique em <strong>Organizar Mapa</strong> para espalhar os conceitos no canvas.</li>
              <li>Use <code>[[Nome do Conceito]]</code> na descrição para criar hiperlinks semânticos.</li>
              <li>Fórmulas LaTeX: <code>$E=mc^2$</code> (inline) ou <code>$$\int f(x)dx$$</code> (bloco).</li>
            </ul>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          Epistemap • Modelagem de Conhecimento
        </div>
      </aside>
    )
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(selectedNode.id, { title: e.target.value })
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNode(selectedNode.id, { description: e.target.value })
  }

  const handleTagBlur = () => {
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    updateNode(selectedNode.id, { tags })
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTagBlur()
    }
  }

  const handleColorSelect = (color: string | null) => {
    updateNode(selectedNode.id, { color })
  }

  const handleAddChild = () => {
    addSubNode(selectedNode.id)
  }

  const handleDrillDown = () => {
    setFocus(selectedNode.id)
  }

  const handleDelete = () => {
    const count = nodes.filter((n) => n.parentId === selectedNode.id).length
    const promptMsg =
      count > 0
        ? `Tem certeza que deseja excluir "${selectedNode.data.title}" e todos os seus ${count} sub-objetos?`
        : `Excluir o conceito "${selectedNode.data.title}"?`

    if (confirm(promptMsg)) {
      removeNode(selectedNode.id)
    }
  }

  return (
    <aside
      style={{
        width: '380px',
        background: '#151821',
        borderLeft: '1px solid #262b3a',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        overflowY: 'auto',
      }}
    >
      {/* Topo do Inspetor */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #262b3a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: selectedNode.data.color || '#6366f1',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#818cf8',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {selectedNode.parentId ? 'Sub-objeto' : 'Conceito Raiz'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleDrillDown}
            title="Drill-down (Focar neste nó)"
            style={{
              background: '#202636',
              border: '1px solid #374151',
              color: '#38bdf8',
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
            onClick={() => select(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Título */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: '6px',
            }}
          >
            TÍTULO DO CONCEITO
          </label>
          <input
            type="text"
            value={selectedNode.data.title}
            onChange={handleTitleChange}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#1e2330',
              border: '1px solid #333d52',
              color: '#f8fafc',
              borderRadius: '5px',
              padding: '8px 10px',
              fontSize: '14px',
              fontWeight: 500,
              outline: 'none',
            }}
          />
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
              color: '#94a3b8',
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
                  key={idx}
                  onClick={() => handleColorSelect(c.value)}
                  title={c.name}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '4px',
                    border: isSelected ? '2px solid #fff' : '1px solid #333d52',
                    backgroundColor: c.value || '#334155',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 6px rgba(255,255,255,0.6)' : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Tags com input local corrigido */}
        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: '6px',
            }}
          >
            <Tag size={12} /> TAGS (SEPARADAS POR VÍRGULA)
          </label>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={handleTagBlur}
            onKeyDown={handleTagKeyDown}
            placeholder="ex: álgebra, cálculo, fundamentos"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#1e2330',
              border: '1px solid #333d52',
              color: '#cbd5e1',
              borderRadius: '5px',
              padding: '6px 10px',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        {/* Sub-objetos */}
        <div style={{ background: '#1c202d', borderRadius: '6px', padding: '12px', border: '1px solid #2a3142' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderTree size={14} color="#818cf8" /> Sub-objetos ({childNodes.length})
            </span>
            <button
              onClick={handleAddChild}
              style={{
                background: '#4f46e5',
                border: 'none',
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
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
              Nenhum sub-objeto ainda. Clique em "Adicionar" para subdividir este conceito.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {childNodes.map((child) => (
                <div
                  key={child.id}
                  onClick={() => select(child.id)}
                  style={{
                    background: '#23293a',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.data.title}
                  </span>
                  <ExternalLink size={12} color="#64748b" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Backlinks / Menções Semânticas */}
        {backlinks.length > 0 && (
          <div style={{ background: '#1c202d', borderRadius: '6px', padding: '12px', border: '1px solid #2a3142' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <LinkIcon size={13} color="#38bdf8" /> Referenciado por ({backlinks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {backlinks.map((b) => (
                <div
                  key={b.id}
                  onClick={() => select(b.id)}
                  style={{
                    background: '#23293a',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#38bdf8',
                    cursor: 'pointer',
                  }}
                >
                  [[{b.data.title}]]
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Descrição Markdown + LaTeX com Links Interativos */}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
              DESCRIÇÃO CIENTÍFICA (MARKDOWN & LATEX)
            </label>
            <div style={{ display: 'flex', background: '#1e2330', borderRadius: '4px', padding: '2px' }}>
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  background: activeTab === 'preview' ? '#2e3547' : 'transparent',
                  border: 'none',
                  color: activeTab === 'preview' ? '#f8fafc' : '#94a3b8',
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
                onClick={() => setActiveTab('edit')}
                style={{
                  background: activeTab === 'edit' ? '#2e3547' : 'transparent',
                  border: 'none',
                  color: activeTab === 'edit' ? '#f8fafc' : '#94a3b8',
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
                background: '#191d28',
                border: '1px solid #333d52',
                color: '#e2e8f0',
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
                background: '#191d28',
                border: '1px solid #282f40',
                borderRadius: '5px',
                padding: '12px',
                color: '#cbd5e1',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            >
              {selectedNode.data.description ? (
                <Markdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    // Renderiza links de texto normais ou [[WikiLinks]]
                    p: ({ children }) => {
                      return <p style={{ margin: '0 0 8px 0' }}>{renderWithWikiLinks(children, nodes, select)}</p>
                    },
                  }}
                >
                  {selectedNode.data.description}
                </Markdown>
              ) : (
                <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '12px' }}>
                  Nenhuma descrição preenchida. Mude para a aba "Editar" para adicionar texto e fórmulas.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Excluir Nó */}
        <div style={{ paddingTop: '8px', borderTop: '1px solid #262b3a' }}>
          <button
            onClick={handleDelete}
            style={{
              width: '100%',
              background: '#2f1f24',
              border: '1px solid #5a2e38',
              color: '#f87171',
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
        </div>
      </div>
    </aside>
  )
}

// Utilitário para transformar [[Nome]] em links clicáveis dentro dos parágrafos do Markdown
function renderWithWikiLinks(
  children: React.ReactNode,
  nodes: ReturnType<typeof useGraphStore.getState>['nodes'],
  selectNode: (id: string | null) => void
): React.ReactNode {
  if (typeof children !== 'string') return children

  const parts = children.split(/(\[\[.*?\]\])/g)
  return parts.map((part, i) => {
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const title = part.slice(2, -2).trim()
      const found = findNodeByTitle(nodes, title)
      if (found) {
        return (
          <button
            key={i}
            onClick={() => selectNode(found.id)}
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
      return (
        <span key={i} style={{ color: '#94a3b8', fontStyle: 'italic' }}>
          [[{title}]]
        </span>
      )
    }
    return part
  })
}
