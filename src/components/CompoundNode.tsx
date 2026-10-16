import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus, Eye, Layers } from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import type { EpistemeNodeData } from '../core/types'

export const CompoundNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as EpistemeNodeData
  const nodes = useGraphStore((s) => s.nodes)
  const addSubNode = useGraphStore((s) => s.addSubNode)
  const toggleNodeExpansion = useGraphStore((s) => s.toggleNodeExpansion)
  const setFocusNode = useGraphStore((s) => s.setFocusNode)
  const selectNode = useGraphStore((s) => s.selectNode)

  const childNodes = nodes.filter((n) => n.parentId === id)
  const childCount = childNodes.length
  const isExpanded = nodeData.isExpanded ?? true
  const isSubnode = Boolean(nodeData.parentId)

  const handleAddSubNode = (e: React.MouseEvent) => {
    e.stopPropagation()
    addSubNode(id)
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNodeExpansion(id)
  }

  const handleDrillDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFocusNode(id)
  }

  return (
    <div
      onClick={() => selectNode(id)}
      style={{
        minWidth: isSubnode ? 180 : 260,
        backgroundColor: isSubnode ? '#1e2230' : '#181b24',
        border: selected ? '2px solid #6366f1' : '1px solid #333a4d',
        borderRadius: '8px',
        color: '#e2e8f0',
        boxShadow: selected ? '0 0 12px rgba(99, 102, 241, 0.4)' : '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
        padding: '12px',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      {/* Handles para conexões direcionais */}
      <Handle type="target" position={Position.Top} style={{ background: '#6366f1', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#6366f1', width: 8, height: 8 }} />

      {/* Cabeçalho do Nó */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <Layers size={14} color={isSubnode ? '#94a3b8' : '#818cf8'} />
          <span style={{ fontWeight: 600, fontSize: isSubnode ? '13px' : '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nodeData.title || 'Sem título'}
          </span>
        </div>

        {/* Contador de sub-objetos */}
        {childCount > 0 && (
          <button
            onClick={handleToggleExpand}
            title={isExpanded ? 'Recolher sub-objetos' : 'Expandir sub-objetos'}
            style={{
              background: '#282e3f',
              border: 'none',
              borderRadius: '4px',
              color: '#94a3b8',
              padding: '2px 6px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {childCount}
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>

      {/* Descrição curta / preview */}
      {nodeData.description && (
        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            marginBottom: '8px',
            lineHeight: 1.4,
            maxHeight: '38px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {nodeData.description}
        </div>
      )}

      {/* Tags */}
      {nodeData.tags && nodeData.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {nodeData.tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '10px',
                background: '#2d3345',
                color: '#cbd5e1',
                borderRadius: '3px',
                padding: '1px 5px',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Ações Rápidas no Rodapé do Nó */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '4px', borderTop: '1px solid #2d3345' }}>
        <button
          onClick={handleAddSubNode}
          title="Subdividir em sub-objeto"
          style={{
            background: '#2e3547',
            border: 'none',
            borderRadius: '4px',
            color: '#c7d2fe',
            padding: '3px 6px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <Plus size={12} />
          Sub-objeto
        </button>

        <button
          onClick={handleDrillDown}
          title="Focar neste nó (Drill-down)"
          style={{
            background: '#2e3547',
            border: 'none',
            borderRadius: '4px',
            color: '#38bdf8',
            padding: '3px 6px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <Eye size={12} />
          Focar
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6366f1', width: 8, height: 8 }} />
    </div>
  )
})
CompoundNode.displayName = 'CompoundNode'
