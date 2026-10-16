import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus, Eye, FolderTree, FileText } from 'lucide-react'
import { useGraphStore } from '../core/graphStore'

type CompoundNodeData = {
  title: string
  description: string
  tags: string[]
  collapsed: boolean
  color: string | null
  childCount: number
  isContainer: boolean
  width: number
  height: number
}

export const CompoundNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as CompoundNodeData
  const addSubNode = useGraphStore((s) => s.addSubNode)
  const toggleCollapse = useGraphStore((s) => s.toggleCollapse)
  const setFocus = useGraphStore((s) => s.setFocus)
  const select = useGraphStore((s) => s.select)

  const isContainer = Boolean(nodeData.isContainer)
  const childCount = nodeData.childCount || 0
  const isCollapsed = Boolean(nodeData.collapsed)
  const accentColor = nodeData.color || '#6366f1'

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

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        select(id)
      }}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: isContainer ? 'rgba(21, 24, 34, 0.65)' : '#161922',
        border: selected
          ? `2px solid ${accentColor}`
          : isContainer
            ? '1.5px dashed rgba(79, 70, 229, 0.35)'
            : '1px solid #2d3345',
        borderRadius: '8px',
        color: '#e2e8f0',
        boxShadow: selected
          ? `0 0 14px ${accentColor}40`
          : '0 4px 6px -1px rgba(0, 0, 0, 0.25)',
        padding: isContainer ? '10px 14px' : '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isContainer ? 'flex-start' : 'space-between',
        cursor: 'pointer',
        transition: 'border 0.15s ease, box-shadow 0.15s ease',
        position: 'relative',
      }}
    >
      {/* Handles para conexões direcionais */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: accentColor, width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: accentColor, width: 8, height: 8 }}
      />

      {/* Cabeçalho do Nó */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          height: '28px',
          borderBottom: isContainer ? '1px solid #282f42' : 'none',
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
            <FolderTree size={13} color="#94a3b8" />
          ) : (
            <FileText size={13} color="#94a3b8" />
          )}
          <span
            style={{
              fontWeight: 600,
              fontSize: isContainer ? '13px' : '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#f8fafc',
            }}
          >
            {nodeData.title || 'Sem título'}
          </span>
        </div>

        {/* Controles de Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {childCount > 0 && (
            <button
              onClick={handleToggleCollapse}
              title={isCollapsed ? 'Expandir sub-objetos' : 'Recolher sub-objetos'}
              style={{
                background: '#232838',
                border: '1px solid #363e54',
                borderRadius: '4px',
                color: '#cbd5e1',
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
            onClick={handleDrillDown}
            title="Drill-down (Focar neste nó)"
            style={{
              background: '#232838',
              border: '1px solid #363e54',
              borderRadius: '4px',
              color: '#38bdf8',
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
          {nodeData.description ? (
            <div
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                lineHeight: 1.35,
                maxHeight: '32px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {nodeData.description}
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
              Clique para descrever
            </div>
          )}

          {/* Tags */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                gap: '4px',
                overflow: 'hidden',
                maxWidth: '130px',
              }}
            >
              {nodeData.tags && nodeData.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '9px',
                    background: '#242a3a',
                    color: '#94a3b8',
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
              onClick={handleAddSubNode}
              title="Adicionar sub-objeto"
              style={{
                background: '#242a3a',
                border: '1px solid #363e54',
                borderRadius: '4px',
                color: '#c7d2fe',
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
            onClick={handleAddSubNode}
            title="Adicionar sub-objeto a este contêiner"
            style={{
              background: '#242a3a',
              border: '1px solid #363e54',
              borderRadius: '4px',
              color: '#c7d2fe',
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
        style={{ background: accentColor, width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: accentColor, width: 8, height: 8 }}
      />
    </div>
  )
})
CompoundNode.displayName = 'CompoundNode'
