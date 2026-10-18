import React, { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X, Play } from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { getTopologicalTourOrder } from '../core/graph'

export interface TourBarProps {
  onStepChange?: (nodeId: string) => void
}

export const TourBar: React.FC<TourBarProps> = ({ onStepChange }) => {
  const isTourActive = useGraphStore((s) => s.isTourActive)
  const tourStepIndex = useGraphStore((s) => s.tourStepIndex)
  const endTour = useGraphStore((s) => s.endTour)
  const nextTourStep = useGraphStore((s) => s.nextTourStep)
  const prevTourStep = useGraphStore((s) => s.prevTourStep)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const theme = useGraphStore((s) => s.theme)

  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const orderedNodes = useMemo(() => {
    return getTopologicalTourOrder(nodes, edges)
  }, [nodes, edges])

  const totalSteps = orderedNodes.length
  const currentNode = orderedNodes[tourStepIndex] || null

  // Notifica mudança de passo para focar câmera
  useEffect(() => {
    if (isTourActive && currentNode) {
      onStepChange?.(currentNode.id)
    }
  }, [isTourActive, currentNode, onStepChange])

  // Atalhos de teclado durante o tour: ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    if (!isTourActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextTourStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevTourStep()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        endTour()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTourActive, nextTourStep, prevTourStep, endTour])

  if (!isTourActive || totalSteps === 0 || !currentNode) {
    return null
  }

  const barBg = isHighContrast
    ? '#ffffff'
    : isLight
      ? 'rgba(255, 255, 255, 0.92)'
      : 'rgba(21, 25, 36, 0.92)'

  const barBorder = isHighContrast
    ? '2px solid #000000'
    : isLight
      ? '1px solid #cbd5e1'
      : '1px solid #2e364f'

  const textColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isHighContrast ? '#333333' : isLight ? '#64748b' : '#94a3b8'
  const btnBg = isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#181d2b'
  const btnBorder = isHighContrast ? '1.5px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #333d58'

  return (
    <div
      role="region"
      aria-label="Controles da Trilha Guiada"
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        backgroundColor: barBg,
        border: barBorder,
        borderRadius: '30px',
        boxShadow: isHighContrast
          ? '0 4px 0 #000000'
          : isLight
            ? '0 12px 28px -6px rgba(0, 0, 0, 0.15), 0 4px 10px -2px rgba(0, 0, 0, 0.05)'
            : '0 16px 36px -6px rgba(0, 0, 0, 0.65), 0 4px 12px -2px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Play size={13} color={isHighContrast ? '#000' : '#818cf8'} style={{ fill: isHighContrast ? '#000' : '#818cf8' }} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isHighContrast ? '#000' : '#818cf8',
          }}
        >
          Tour
        </span>
      </div>

      <div style={{ width: '1px', height: '18px', backgroundColor: isHighContrast ? '#000' : isLight ? '#cbd5e1' : '#2e364f' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={prevTourStep}
          disabled={tourStepIndex === 0}
          title="Conceito Anterior (←)"
          aria-label="Conceito Anterior"
          style={{
            background: btnBg,
            border: btnBorder,
            borderRadius: '50%',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: tourStepIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: tourStepIndex === 0 ? 0.4 : 1,
            color: textColor,
          }}
        >
          <ChevronLeft size={14} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '160px', maxWidth: '280px' }}>
          <span style={{ fontSize: '10px', color: textMuted, fontWeight: 600 }}>
            Passo {tourStepIndex + 1} de {totalSteps}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {currentNode.data.title}
          </span>
        </div>

        <button
          type="button"
          onClick={nextTourStep}
          disabled={tourStepIndex === totalSteps - 1}
          title="Próximo Conceito (→)"
          aria-label="Próximo Conceito"
          style={{
            background: btnBg,
            border: btnBorder,
            borderRadius: '50%',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: tourStepIndex === totalSteps - 1 ? 'not-allowed' : 'pointer',
            opacity: tourStepIndex === totalSteps - 1 ? 0.4 : 1,
            color: textColor,
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ width: '1px', height: '18px', backgroundColor: isHighContrast ? '#000' : isLight ? '#cbd5e1' : '#2e364f' }} />

      <button
        type="button"
        onClick={endTour}
        title="Encerrar Trilha Guiada (Esc)"
        aria-label="Encerrar Trilha Guiada"
        style={{
          background: 'transparent',
          border: 'none',
          color: textMuted,
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
