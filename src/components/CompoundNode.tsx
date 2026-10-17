import React, { memo, useCallback } from 'react'
import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus, Eye, FolderTree, FileText, Paperclip } from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { getZoomLodLevel, renderMathText } from '../core/lod'
import type { PdfAttachment, ZoomLodLevel, ChildNodeSummary } from '../core/types'

type CompoundNodeData = {
  title: string
  description: string
  tags: string[]
  collapsed: boolean
  color: string | null
  childCount: number
  isContainer: boolean
  childrenSummary?: ChildNodeSummary[]
  isDropTarget?: boolean
  isDimmed?: boolean
  pdfAttachment?: PdfAttachment | null
  width: number
  height: number
  lodLevel?: ZoomLodLevel
}

function formatCompactDescription(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/\$\$(.*?)\$\$/gs, '∑ $1')
    .replace(/\$(.*?)\$/g, '$1')
    .replace(/\[\[(.*?)\]\]/g, '↗ $1')
}

export const CompoundNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as CompoundNodeData
  const addSubNode = useGraphStore((s) => s.addSubNode)
  const toggleCollapse = useGraphStore((s) => s.toggleCollapse)
  const setFocus = useGraphStore((s) => s.setFocus)
  const select = useGraphStore((s) => s.select)
  const theme = useGraphStore((s) => s.theme)

  // Subscrição estritamente discreta ao nível de zoom da câmera via selector Zustand do React Flow
  const storeLod = useStore(
    useCallback((s: { transform: [number, number, number] }) => getZoomLodLevel(s.transform[2]), [])
  )
  const lodLevel: ZoomLodLevel = nodeData.lodLevel ?? storeLod

  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const isContainer = Boolean(nodeData.isContainer)
  const childCount = nodeData.childCount || 0
  const isCollapsed = Boolean(nodeData.collapsed)
  const isDropTarget = Boolean(nodeData.isDropTarget)
  const isDimmed = Boolean(nodeData.isDimmed)
  const accentColor = isHighContrast ? '#000000' : nodeData.color || '#6366f1'
  const handleColor = isHighContrast ? '#000000' : accentColor
  const childrenSummary = nodeData.childrenSummary || []

  const handleAddSubNode = (e: React.MouseEvent) => {
    e.stopPropagation()
    addSubNode(id)
  }

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleCollapse(id)
  }

  const handleDrillDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFocus(id)
  }

  // Estilização condicional baseada no tema
  const cardBg = isHighContrast
    ? '#ffffff'
    : isDropTarget
      ? 'rgba(16, 185, 129, 0.14)'
      : isLight
        ? isContainer
          ? 'rgba(241, 245, 249, 0.85)'
          : '#ffffff'
        : isContainer
          ? 'rgba(21, 24, 34, 0.65)'
          : '#161922'

  const cardBorder = isHighContrast
    ? isDropTarget
      ? '3px dashed #000000'
      : selected
        ? '3px solid #000000'
        : '2px solid #000000'
    : isDropTarget
      ? '2px solid #10b981'
      : selected
        ? `2px solid ${accentColor}`
        : isLight
          ? isContainer
            ? '1.5px dashed rgba(99, 102, 241, 0.45)'
            : '1px solid #cbd5e1'
          : isContainer
            ? '1.5px dashed rgba(79, 70, 229, 0.35)'
            : '1px solid #2d3345'

  const cardTextColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#e2e8f0'
  const cardTitleColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#f8fafc'
  const cardDescColor = isHighContrast ? '#000000' : isLight ? '#475569' : '#94a3b8'
  const cardBorderBottom = isHighContrast
    ? '2px solid #000000'
    : isLight
      ? '1px solid #e2e8f0'
      : '1px solid #282f42'

  // ==========================================
  // RENDERIZAÇÃO: MODO MACRO (Zoom < 0.65)
  // Visão minimalista, limpa de pássaro (zero ruído)
  // ==========================================
  if (lodLevel === 'macro') {
    return (
      <div
        className={`compound-node-inner ${selected ? 'epistemap-node-selected' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          select(id)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (childCount > 0) setFocus(id)
        }}
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          backgroundColor: cardBg,
          border: cardBorder,
          borderRadius: '8px',
          color: cardTextColor,
          padding: isContainer ? '10px 14px' : '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isContainer ? 'flex-start' : 'center',
          alignItems: isContainer ? 'flex-start' : 'center',
          textAlign: isContainer ? 'left' : 'center',
          cursor: 'pointer',
          opacity: isDimmed ? 0.32 : 1,
          position: 'relative',
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="epistemap-handle"
          style={{ background: handleColor, width: 8, height: 8 }}
        />
        <Handle
          type="target"
          position={Position.Left}
          className="epistemap-handle"
          style={{ background: handleColor, width: 8, height: 8 }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            maxWidth: '100%',
            justifyContent: isContainer ? 'flex-start' : 'center',
            width: isContainer ? '100%' : 'auto',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: accentColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: '13px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: cardTitleColor,
            }}
          >
            {nodeData.title || 'Sem título'}
          </span>
          {childCount > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                backgroundColor: isHighContrast ? '#000000' : isLight ? '#e2e8f0' : '#232838',
                color: isHighContrast ? '#ffffff' : isLight ? '#334155' : '#cbd5e1',
                borderRadius: '4px',
                padding: '1px 5px',
                flexShrink: 0,
              }}
            >
              {childCount}
            </span>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="epistemap-handle"
          style={{ background: handleColor, width: 8, height: 8 }}
        />
        <Handle
          type="source"
          position={Position.Right}
          className="epistemap-handle"
          style={{ background: handleColor, width: 8, height: 8 }}
        />
      </div>
    )
  }

  // ==========================================
  // RENDERIZAÇÃO: MODO STANDARD & MICRO
  // ==========================================
  const isMicro = lodLevel === 'micro'

  return (
    <div
      className={`compound-node-inner ${selected ? 'epistemap-node-selected' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        select(id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (childCount > 0) {
          setFocus(id)
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: cardBg,
        border: cardBorder,
        borderRadius: '8px',
        color: cardTextColor,
        boxShadow: isHighContrast
          ? 'none'
          : isDropTarget
            ? '0 0 22px rgba(16, 185, 129, 0.55), inset 0 0 12px rgba(16, 185, 129, 0.15)'
            : selected
              ? `0 0 14px ${accentColor}40`
              : isLight
                ? '0 2px 4px rgba(0, 0, 0, 0.06)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.25)',
        padding: isContainer ? '10px 14px' : '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isContainer ? 'flex-start' : 'space-between',
        cursor: 'pointer',
        opacity: isDimmed ? 0.32 : 1,
        transition: 'border 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease, background-color 0.15s ease',
        position: 'relative',
      }}
    >
      {/* Indicador visual de Drop Target */}
      {isDropTarget && (
        <div
          style={{
            position: 'absolute',
            top: '-11px',
            right: '10px',
            backgroundColor: isHighContrast ? '#000000' : '#10b981',
            color: isHighContrast ? '#ffffff' : '#06281e',
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '4px',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            zIndex: 5,
          }}
        >
          Soltar para aninhar
        </div>
      )}

      {/* Handles para conexões direcionais */}
      <Handle
        type="target"
        position={Position.Top}
        className="epistemap-handle"
        style={{ background: handleColor, width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="epistemap-handle"
        style={{ background: handleColor, width: 8, height: 8 }}
      />

      {/* Cabeçalho do Nó */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          height: '28px',
          borderBottom: isContainer ? cardBorderBottom : 'none',
          paddingBottom: isContainer ? '6px' : '0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: accentColor,
              flexShrink: 0,
            }}
          />
          {isContainer ? (
            <FolderTree size={13} color={isHighContrast ? '#000000' : isLight ? '#64748b' : '#94a3b8'} />
          ) : (
            <FileText size={13} color={isHighContrast ? '#000000' : isLight ? '#64748b' : '#94a3b8'} />
          )}
          <span
            style={{
              fontWeight: 600,
              fontSize: isContainer ? '13px' : '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: cardTitleColor,
            }}
          >
            {nodeData.title || 'Sem título'}
          </span>

          {/* Badge Indicador de PDF acoplado */}
          {nodeData.pdfAttachment && (
            <span
              title={`PDF acoplado: ${nodeData.pdfAttachment.name} (pág. ${nodeData.pdfAttachment.page || 1})`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '9px',
                backgroundColor: isHighContrast ? '#000000' : '#4f46e5',
                color: '#ffffff',
                borderRadius: '3px',
                padding: '1px 4px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <Paperclip size={9} />
              <span>p.{nodeData.pdfAttachment.page || 1}</span>
            </span>
          )}
        </div>

        {/* Controles de Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {childCount > 0 && (
            <button
              type="button"
              onClick={handleToggleCollapse}
              title={isCollapsed ? 'Expandir sub-objetos' : 'Recolher sub-objetos'}
              style={{
                background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#232838',
                border: isHighContrast ? '1.5px solid #000' : isLight ? '1px solid #cbd5e1' : '1px solid #363e54',
                borderRadius: '4px',
                color: isHighContrast ? '#000000' : isLight ? '#334155' : '#cbd5e1',
                padding: '2px 5px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>{childCount}</span>
              {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
            </button>
          )}

          <button
            type="button"
            onClick={handleDrillDown}
            title="Drill-down (Focar neste nó)"
            style={{
              background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#232838',
              border: isHighContrast ? '1.5px solid #000' : isLight ? '1px solid #cbd5e1' : '1px solid #363e54',
              borderRadius: '4px',
              color: isHighContrast ? '#000000' : isLight ? '#0284c7' : '#38bdf8',
              padding: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Eye size={11} />
          </button>
        </div>
      </div>

      {/* Conteúdo específico para nós folha ou recolhidos */}
      {!isContainer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          {/* Caso MICRO em contêiner recolhido: Revela lista de seções e definições internas */}
          {isMicro && isCollapsed && childCount > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                overflowY: 'auto',
                maxHeight: '38px',
                paddingRight: '2px',
              }}
            >
              {childrenSummary.map((child) => (
                <div
                  key={child.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    select(child.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setFocus(child.id)
                  }}
                  title={`Sub-conceito: ${child.title} (Clique para selecionar, duplo clique para focar)`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: child.color || accentColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: cardTitleColor,
                      fontWeight: 500,
                    }}
                  >
                    {child.title}
                  </span>
                </div>
              ))}
            </div>
          ) : nodeData.description ? (
            /* Caso MICRO em nó folha: renderização de fórmulas matemáticas KaTeX inline */
            isMicro ? (
              <div
                style={{
                  fontSize: '11px',
                  color: cardDescColor,
                  lineHeight: 1.35,
                  maxHeight: '32px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
                dangerouslySetInnerHTML={{ __html: renderMathText(nodeData.description) }}
              />
            ) : (
              /* Caso STANDARD: visual resumido truncado */
              <div
                style={{
                  fontSize: '11px',
                  color: cardDescColor,
                  lineHeight: 1.35,
                  maxHeight: '32px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {formatCompactDescription(nodeData.description)}
              </div>
            )
          ) : (
            <div
              style={{
                fontSize: '10px',
                color: isHighContrast ? '#444' : isLight ? '#94a3b8' : '#64748b',
                fontStyle: 'italic',
              }}
            >
              Clique para descrever
            </div>
          )}

          {/* Tags e botão de adicionar sub-objeto */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                gap: '4px',
                overflow: 'hidden',
                maxWidth: '130px',
              }}
            >
              {nodeData.tags &&
                nodeData.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '9px',
                      background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#242a3a',
                      border: isHighContrast ? '1px solid #000000' : 'none',
                      color: isHighContrast ? '#000000' : isLight ? '#475569' : '#94a3b8',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
            </div>

            <button
              type="button"
              onClick={handleAddSubNode}
              title="Adicionar sub-objeto"
              style={{
                background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#242a3a',
                border: isHighContrast ? '1.5px solid #000' : isLight ? '1px solid #cbd5e1' : '1px solid #363e54',
                borderRadius: '4px',
                color: isHighContrast ? '#000000' : isLight ? '#4338ca' : '#c7d2fe',
                padding: '2px 5px',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <Plus size={10} /> Sub
            </button>
          </div>
        </div>
      )}

      {/* Ação rápida para adicionar sub-objeto dentro de contêiner aberto */}
      {isContainer && (
        <div style={{ position: 'absolute', bottom: '6px', right: '10px' }}>
          <button
            type="button"
            onClick={handleAddSubNode}
            title="Adicionar sub-objeto a este contêiner"
            style={{
              background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#242a3a',
              border: isHighContrast ? '1.5px solid #000' : isLight ? '1px solid #cbd5e1' : '1px solid #363e54',
              borderRadius: '4px',
              color: isHighContrast ? '#000000' : isLight ? '#4338ca' : '#c7d2fe',
              padding: '2px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <Plus size={10} /> Sub-objeto
          </button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="epistemap-handle"
        style={{ background: handleColor, width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="epistemap-handle"
        style={{ background: handleColor, width: 8, height: 8 }}
      />
    </div>
  )
})
CompoundNode.displayName = 'CompoundNode'
