import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Search, FolderTree, FileText, CornerDownLeft, Hash, X } from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { searchNodes, type SearchMatchCategory } from '../core/graph'

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate?: (nodeId: string) => void
}

const MATCH_LABELS: Record<SearchMatchCategory, { text: string; color: string }> = {
  title: { text: 'Título', color: '#818cf8' },
  tag: { text: 'Tag', color: '#38bdf8' },
  description: { text: 'Conteúdo', color: '#10b981' },
}

export const CommandPalette: React.FC<CommandPaletteProps> = (props) => {
  if (!props.isOpen) return null
  return <CommandPaletteDialog {...props} />
}

const CommandPaletteDialog: React.FC<CommandPaletteProps> = ({
  onClose,
  onNavigate,
}) => {
  const nodes = useGraphStore((s) => s.nodes)
  const navigateToNode = useGraphStore((s) => s.navigateToNode)
  const theme = useGraphStore((s) => s.theme)

  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const modalBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#151822'
  const modalBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #2e364f'
  const headerBg = isHighContrast ? '#ffffff' : isLight ? '#f8fafc' : '#191d29'
  const headerBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #e2e8f0' : '1px solid #262c3e'
  const textColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isHighContrast ? '#000000' : isLight ? '#64748b' : '#94a3b8'
  const footerBg = isHighContrast ? '#ffffff' : isLight ? '#f8fafc' : '#12151f'
  const footerBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #e2e8f0' : '1px solid #262c3e'
  const selectedItemBg = isHighContrast ? '#f4f4f5' : isLight ? '#f1f5f9' : '#23293d'
  const selectedItemBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #3b4466'

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    return searchNodes(nodes, query)
  }, [nodes, query])

  const safeIndex = results.length > 0 ? Math.min(selectedIndex, results.length - 1) : 0

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleClose = () => {
    setQuery('')
    setSelectedIndex(0)
    onClose()
  }

  const handleSelect = (nodeId: string) => {
    navigateToNode(nodeId)
    onNavigate?.(nodeId)
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = results[safeIndex]
      if (current) {
        handleSelect(current.node.id)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca Global de Conceitos"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isHighContrast ? 'rgba(0, 0, 0, 0.45)' : 'rgba(9, 11, 17, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: modalBg,
          border: modalBorder,
          borderRadius: '10px',
          boxShadow: isHighContrast ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Barra de Pesquisa */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: headerBorder,
            backgroundColor: headerBg,
          }}
        >
          <Search size={18} color={isHighContrast ? '#000000' : '#818cf8'} />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar conceitos por título, #tag ou conteúdo..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: textColor,
              fontSize: '14px',
              outline: 'none',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setSelectedIndex(0)
                inputRef.current?.focus()
              }}
              aria-label="Limpar busca"
              style={{
                background: 'transparent',
                border: 'none',
                color: textMuted,
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <X size={15} />
            </button>
          )}
          <span
            style={{
              fontSize: '10px',
              color: textMuted,
              background: isHighContrast ? '#ffffff' : isLight ? '#e2e8f0' : '#232838',
              border: isHighContrast ? '1px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #333b52',
              borderRadius: '4px',
              padding: '2px 6px',
            }}
          >
            ESC
          </span>
        </div>

        {/* Lista de Resultados */}
        <div
          role="listbox"
          aria-label="Resultados da busca"
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: textMuted,
                fontSize: '13px',
              }}
            >
              Nenhum conceito encontrado para <strong>"{query}"</strong>.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === safeIndex
              const badge = MATCH_LABELS[item.matchType]
              const hasChildren = nodes.some((n) => n.parentId === item.node.id)

              return (
                <div
                  key={item.node.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelect(item.node.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? selectedItemBg : 'transparent',
                    border: isSelected ? selectedItemBorder : '1px solid transparent',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: isHighContrast ? '#000000' : item.node.data.color || '#6366f1',
                          flexShrink: 0,
                        }}
                      />
                      {hasChildren ? (
                        <FolderTree size={13} color={isHighContrast ? '#000000' : '#818cf8'} />
                      ) : (
                        <FileText size={13} color={isHighContrast ? '#000000' : isLight ? '#64748b' : '#94a3b8'} />
                      )}
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: textColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.node.data.title}
                      </span>
                      {item.path.length > 0 && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: textMuted,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          em {item.path.join(' › ')}
                        </span>
                      )}
                    </div>

                    {item.node.data.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', paddingLeft: '22px', flexWrap: 'wrap' }}>
                        {item.node.data.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '10px',
                              color: textMuted,
                              background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#1c202e',
                              border: isHighContrast ? '1px solid #000000' : isLight ? '1px solid #cbd5e1' : 'none',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <Hash size={9} />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {query.trim() && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: isHighContrast ? '#000000' : badge.color,
                          backgroundColor: isHighContrast ? '#ffffff' : `${badge.color}1a`,
                          border: isHighContrast ? '1px solid #000000' : `1px solid ${badge.color}4d`,
                          borderRadius: '4px',
                          padding: '1px 6px',
                        }}
                      >
                        {badge.text}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft size={13} color={isHighContrast ? '#000000' : '#818cf8'} />}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé com dicas */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: footerBorder,
            backgroundColor: footerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: textMuted,
          }}
        >
          <span>Use ↑↓ para navegar e Enter para focar no conceito (expande ancestrais automaticamente)</span>
          <span>{results.length} conceito(s)</span>
        </div>
      </div>
    </div>
  )
}
