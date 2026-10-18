import React, { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Download,
  Bookmark,
  Trash2,
  X,
  FileText,
} from 'lucide-react'
import type { PdfAttachment } from '../core/types'
import { useGraphStore } from '../core/graphStore'

export interface PdfViewerPanelProps {
  attachment: PdfAttachment
  onUpdatePage?: (newPage: number) => void
  onRemove?: () => void
  onClose?: () => void
}

export const PdfViewerPanel: React.FC<PdfViewerPanelProps> = ({
  attachment,
  onUpdatePage,
  onRemove,
  onClose,
}) => {
  const theme = useGraphStore((s) => s.theme)
  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const [page, setPage] = useState<number>(attachment.page || 1)
  const [pageInput, setPageInput] = useState<string>(String(attachment.page || 1))
  const [zoom, setZoom] = useState<number>(100)
  const [isSavedRef, setIsSavedRef] = useState<boolean>(true)
  const [prevAttachment, setPrevAttachment] = useState(attachment)
  if (
    attachment.page !== prevAttachment.page ||
    attachment.name !== prevAttachment.name ||
    attachment.base64 !== prevAttachment.base64 ||
    attachment.filePath !== prevAttachment.filePath
  ) {
    setPrevAttachment(attachment)
    setPage(attachment.page || 1)
    setPageInput(String(attachment.page || 1))
    setIsSavedRef(true)
  }

  // Cria Blob URL a partir do base64 auto-contido ou usa rota local /api/pdf para filePath
  const blobUrl = useMemo(() => {
    if (!attachment.base64) {
      if (attachment.filePath) {
        return `/api/pdf?path=${encodeURIComponent(attachment.filePath)}`
      }
      return null
    }
    try {
      const raw = attachment.base64.includes(',')
        ? attachment.base64.split(',')[1]
        : attachment.base64
      const binaryStr = atob(raw)
      const len = binaryStr.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(blob)
      }
      return attachment.base64.startsWith('data:')
        ? attachment.base64
        : `data:application/pdf;base64,${attachment.base64}`
    } catch {
      return attachment.base64.startsWith('data:')
        ? attachment.base64
        : `data:application/pdf;base64,${attachment.base64}`
    }
  }, [attachment.base64, attachment.filePath])

  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  const handlePrevPage = () => {
    setPage((prev) => {
      const next = Math.max(1, prev - 1)
      setPageInput(String(next))
      setIsSavedRef(next === attachment.page)
      return next
    })
  }

  const handleNextPage = () => {
    setPage((prev) => {
      const next = prev + 1
      setPageInput(String(next))
      setIsSavedRef(next === attachment.page)
      return next
    })
  }

  const handleJumpPage = () => {
    const parsed = parseInt(pageInput.trim(), 10)
    const targetPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
    setPage(targetPage)
    setPageInput(String(targetPage))
    setIsSavedRef(targetPage === attachment.page)
  }

  const handlePageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleJumpPage()
    }
  }

  const handleSaveReferencePage = () => {
    onUpdatePage?.(page)
    setIsSavedRef(true)
  }

  const handleOpenExternal = () => {
    if (attachment.filePath) {
      fetch('/api/open-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: attachment.filePath, page }),
      }).catch(() => {
        if (blobUrl) window.open(`${blobUrl}#page=${page}`, '_blank')
      })
      return
    }
    if (!blobUrl) return
    window.open(`${blobUrl}#page=${page}`, '_blank')
  }

  const handleDownload = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = attachment.name || 'documento.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleZoomIn = () => {
    setZoom((z) => Math.min(250, z + 20))
  }

  const handleZoomOut = () => {
    setZoom((z) => Math.max(50, z - 20))
  }

  // Estilização temática
  const panelBg = isHighContrast ? '#ffffff' : isLight ? '#f8fafc' : '#151821'
  const textColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isHighContrast ? '#000000' : isLight ? '#475569' : '#94a3b8'
  const borderCol = isHighContrast ? '#000000' : isLight ? '#e2e8f0' : '#262b3a'
  const btnBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#1e2433'
  const btnBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #333d52'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: panelBg,
        color: textColor,
        border: isHighContrast ? '2px solid #000000' : 'none',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      {/* Barra Superior do Leitor de PDF */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: isHighContrast ? '2px solid #000000' : `1px solid ${borderCol}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#181b26',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <FileText size={15} color={isHighContrast ? '#000000' : '#818cf8'} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '180px',
            }}
            title={attachment.name}
          >
            {attachment.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={handleOpenExternal}
            title="Abrir no leitor de PDF externo do sistema"
            aria-label="Abrir no leitor de PDF externo"
            style={{
              background: btnBg,
              border: btnBorder,
              color: textColor,
              borderRadius: '4px',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            <ExternalLink size={12} />
            <span>Leitor Externo</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Baixar arquivo PDF"
            aria-label="Baixar PDF"
            style={{
              background: btnBg,
              border: btnBorder,
              color: textColor,
              borderRadius: '4px',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Download size={12} />
          </button>

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remover PDF acoplado"
              aria-label="Remover anexo PDF"
              style={{
                background: btnBg,
                border: isHighContrast ? '2px solid #000' : '1px solid #7f1d1d',
                color: isHighContrast ? '#000' : '#f87171',
                borderRadius: '4px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Trash2 size={12} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Fechar leitor e voltar aos detalhes"
              aria-label="Fechar leitor"
              style={{
                background: 'transparent',
                border: 'none',
                color: textMuted,
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Controles de Navegação de Página e Zoom */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: isHighContrast ? '2px solid #000000' : `1px solid ${borderCol}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#141722',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* Paginação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={page <= 1}
            title="Página Anterior"
            aria-label="Página Anterior"
            style={{
              background: btnBg,
              border: btnBorder,
              color: page <= 1 ? (isHighContrast ? '#888' : '#64748b') : textColor,
              borderRadius: '4px',
              padding: '3px 6px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={13} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
            <span style={{ color: textMuted }}>Pág.</span>
            <input
              type="number"
              min={1}
              value={pageInput}
              onChange={(e) => {
                setPageInput(e.target.value)
                setIsSavedRef(false)
              }}
              onKeyDown={handlePageKeyDown}
              aria-label="Número da página"
              style={{
                width: '44px',
                background: isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#1e2330',
                border: btnBorder,
                color: textColor,
                borderRadius: '3px',
                padding: '2px 4px',
                fontSize: '11px',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleJumpPage}
              title="Ir para página informada"
              style={{
                background: btnBg,
                border: btnBorder,
                color: textColor,
                borderRadius: '3px',
                padding: '2px 5px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Ir
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            title="Próxima Página"
            aria-label="Próxima Página"
            style={{
              background: btnBg,
              border: btnBorder,
              color: textColor,
              borderRadius: '4px',
              padding: '3px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Salvar como página de referência do nó */}
        <button
          type="button"
          onClick={handleSaveReferencePage}
          title={
            isSavedRef
              ? 'Esta página é a referência atual do conceito'
              : 'Definir esta página como a referência deste conceito'
          }
          style={{
            background: isSavedRef
              ? isHighContrast
                ? '#000000'
                : '#4f46e5'
              : btnBg,
            border: btnBorder,
            color: isSavedRef ? '#ffffff' : textColor,
            borderRadius: '4px',
            padding: '3px 7px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <Bookmark size={11} />
          <span>{isSavedRef ? `Ref (p.${page})` : `Fixar p.${page}`}</span>
        </button>

        {/* Controles de Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Reduzir Zoom"
            aria-label="Reduzir Zoom"
            style={{
              background: btnBg,
              border: btnBorder,
              color: textColor,
              borderRadius: '3px',
              padding: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ZoomOut size={12} />
          </button>
          <span style={{ fontSize: '10px', color: textMuted, minWidth: '32px', textAlign: 'center' }}>
            {zoom}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Aumentar Zoom"
            aria-label="Aumentar Zoom"
            style={{
              background: btnBg,
              border: btnBorder,
              color: textColor,
              borderRadius: '3px',
              padding: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* Área de Visualização do PDF */}
      <div style={{ flex: 1, minHeight: '380px', position: 'relative', background: '#000000' }}>
        {blobUrl ? (
          <object
            key={`${blobUrl}-${page}-${zoom}`}
            data={`${blobUrl}#page=${page}&zoom=${zoom}`}
            type="application/pdf"
            title={attachment.name}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '380px',
              border: 'none',
              display: 'block',
            }}
          >
            <iframe
              key={`${blobUrl}-${page}-${zoom}`}
              src={`${blobUrl}#page=${page}&zoom=${zoom}`}
              title={attachment.name}
              style={{
                width: '100%',
                height: '100%',
                minHeight: '380px',
                border: 'none',
                display: 'block',
              }}
            >
              <div
                style={{
                  padding: '20px',
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: '12px',
                }}
              >
                Seu navegador não suporta visualização embutida de PDF.{' '}
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  style={{
                    color: '#38bdf8',
                    textDecoration: 'underline',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Abrir no leitor externo
                </button>
              </div>
            </iframe>
          </object>
        ) : (
          <div
            style={{
              padding: '30px',
              textAlign: 'center',
              color: textMuted,
              fontSize: '13px',
            }}
          >
            Não foi possível carregar o arquivo PDF.
          </div>
        )}
      </div>
    </div>
  )
}
