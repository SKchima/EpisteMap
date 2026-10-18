import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Home,
  Plus,
  Download,
  Upload,
  Search,
  Undo2,
  Redo2,
  Image as ImageIcon,
  FileCode,
  Settings,
} from 'lucide-react'
import { getViewportForBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useGraphStore } from '../core/graphStore'
import { getBreadcrumbs } from '../core/graph'
import { buildFlowElements, computeNodeBoundingBoxes } from '../core/layout'
import { parseTexDocument } from '../core/texImporter'
import { useVaultSync } from '../core/useVaultSync'

export interface BreadcrumbsBarProps {
  onOpenSearch?: () => void
  onOpenSettings?: () => void
  onOpenShortcuts?: () => void
}

export const BreadcrumbsBar: React.FC<BreadcrumbsBarProps> = ({
  onOpenSearch,
  onOpenSettings,
}) => {
  const { isConnected, isSyncing, vaultPath, forceReload } = useVaultSync()
  const focusId = useGraphStore((s) => s.focusId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeTag = useGraphStore((s) => s.activeTag)
  const theme = useGraphStore((s) => s.theme)
  const canUndo = useGraphStore((s) => s.canUndo)
  const canRedo = useGraphStore((s) => s.canRedo)
  const setFocus = useGraphStore((s) => s.setFocus)
  const setActiveTag = useGraphStore((s) => s.setActiveTag)
  const addRootNode = useGraphStore((s) => s.addRootNode)
  const organizeMap = useGraphStore((s) => s.organizeMap)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const importBatch = useGraphStore((s) => s.importBatch)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const editorMode = useGraphStore((s) => s.editorMode)
  const setEditorMode = useGraphStore((s) => s.setEditorMode)
  const isTourActive = useGraphStore((s) => s.isTourActive)
  const startTour = useGraphStore((s) => s.startTour)
  const endTour = useGraphStore((s) => s.endTour)

  const [isExportingImage, setIsExportingImage] = useState(false)
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const texInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isFileMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFileMenuOpen])

  const breadcrumbs = useMemo(() => {
    return getBreadcrumbs(nodes, focusId)
  }, [nodes, focusId])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const n of nodes) {
      for (const t of n.data.tags) {
        if (t.trim()) tagSet.add(t.trim())
      }
    }
    return Array.from(tagSet).sort()
  }, [nodes])

  const handleCreateRoot = () => {
    addRootNode('Novo Conceito')
  }

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'epistemap-export.json')
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleExportPNG = async () => {
    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!viewportEl || nodes.length === 0 || isExportingImage) return

    setIsExportingImage(true)
    try {
      const { flowNodes } = buildFlowElements(nodes, edges, {
        focusId,
        selectedId: null,
      })
      const boxes = computeNodeBoundingBoxes(flowNodes)

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const box of boxes.values()) {
        minX = Math.min(minX, box.x)
        minY = Math.min(minY, box.y)
        maxX = Math.max(maxX, box.x + box.width)
        maxY = Math.max(maxY, box.y + box.height)
      }

      if (!Number.isFinite(minX)) {
        minX = 0
        minY = 0
        maxX = 1280
        maxY = 800
      }

      const rawWidth = maxX - minX
      const rawHeight = maxY - minY
      const targetWidth = Math.max(400, rawWidth)
      const targetHeight = Math.max(300, rawHeight)

      const bounds = {
        x: minX - (targetWidth - rawWidth) / 2,
        y: minY - (targetHeight - rawHeight) / 2,
        width: targetWidth,
        height: targetHeight,
      }

      const imageWidth = Math.min(3840, Math.max(1280, Math.ceil(bounds.width + 160)))
      const imageHeight = Math.min(2160, Math.max(800, Math.ceil(bounds.height + 160)))

      const viewport = getViewportForBounds(
        bounds,
        imageWidth,
        imageHeight,
        0.2,
        2,
        0.15
      )

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: theme === 'high-contrast' ? '#ffffff' : theme === 'light' ? '#f8fafc' : '#0e111a',
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        skipFonts: true,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      })

      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataUrl)
      downloadAnchor.setAttribute('download', 'epistemap-hd.png')
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    } catch (err) {
      console.error('Erro ao exportar PNG:', err)
    } finally {
      setIsExportingImage(false)
    }
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (parsed && Array.isArray(parsed.nodes)) {
          loadGraph(parsed)
        } else {
          alert('Arquivo JSON inválido. Estrutura esperada: { nodes: [], edges: [] }')
        }
      } catch (err) {
        alert('Erro ao processar JSON: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportTex = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        if (content) {
          const parsed = parseTexDocument(content)
          if (parsed.nodes.length > 0) {
            importBatch(parsed.nodes, parsed.edges)
          } else {
            alert('Nenhum conceito ou teorema identificado no arquivo .tex.')
          }
        }
      } catch (err) {
        alert('Erro ao processar arquivo .tex: ' + (err as Error).message)
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const isHighContrast = theme === 'high-contrast'
  const isLight = theme === 'light'

  const headerBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#12151c'
  const headerBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #e2e8f0' : '1px solid #262b3a'
  const btnBg = isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#191e2c'
  const btnBorder = isHighContrast ? '1.5px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #2e364f'
  const textColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#cbd5e1'
  const dividerColor = isHighContrast ? '#000000' : isLight ? '#e2e8f0' : '#262d3d'

  const menuBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#181c28'
  const menuBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #2d354a'
  const menuShadow = isHighContrast
    ? 'none'
    : isLight
      ? '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
      : '0 14px 32px -4px rgba(0,0,0,0.65), 0 4px 12px -2px rgba(0,0,0,0.45)'
  const menuSectionLabelColor = isHighContrast ? '#000000' : isLight ? '#64748b' : '#64748b'
  const itemDescColor = isHighContrast ? '#333333' : isLight ? '#64748b' : '#8592a6'

  return (
    <header
      style={{
        height: '52px',
        background: headerBg,
        borderBottom: headerBorder,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
        zIndex: 10,
        gap: '12px',
      }}
    >
      {/* Logotipo e Trilha de Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '6px' }}>
          <img
            src="/favicon.svg"
            alt="EpisteMap Logo"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '5px',
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#818cf8', letterSpacing: '-0.3px' }}>
            EpisteMap
          </span>
        </div>

        <nav
          aria-label="Hierarquia do Mapa"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <React.Fragment key={crumb.id || 'root'}>
                {idx > 0 && <ChevronRight size={14} color={isHighContrast ? '#000000' : isLight ? '#94a3b8' : '#64748b'} />}
                <button
                  onClick={() => setFocus(crumb.id)}
                  style={{
                    background: isLast
                      ? isHighContrast
                        ? '#000000'
                        : isLight
                          ? '#e2e8f0'
                          : '#1e2332'
                      : 'transparent',
                    border: isLast
                      ? isHighContrast
                        ? '1.5px solid #000000'
                        : isLight
                          ? '1px solid #cbd5e1'
                          : '1px solid #3b4259'
                      : 'none',
                    color: isLast
                      ? isHighContrast
                        ? '#ffffff'
                        : isLight
                          ? '#0f172a'
                          : '#f8fafc'
                      : isHighContrast
                        ? '#000000'
                        : isLight
                          ? '#64748b'
                          : '#94a3b8',
                    fontWeight: isLast ? 600 : 400,
                    fontSize: '12px',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {idx === 0 && <Home size={12} />}
                  {crumb.title}
                </button>
              </React.Fragment>
            )
          })}
        </nav>
      </div>

      {/* Ações Globais */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Busca Global Cmd+K */}
        <button
          type="button"
          onClick={onOpenSearch}
          title="Busca Global de Conceitos (Ctrl+K / Cmd+K)"
          style={{
            background: btnBg,
            color: textColor,
            border: btnBorder,
            borderRadius: '5px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Search size={13} color={isHighContrast ? '#000000' : '#818cf8'} />
          <span>Buscar...</span>
          <kbd
            style={{
              fontSize: '10px',
              background: isHighContrast ? '#ffffff' : isLight ? '#e2e8f0' : '#252b3d',
              color: textColor,
              padding: '1px 4px',
              borderRadius: '3px',
              border: btnBorder,
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Filtro Rápido por Tag */}
        {allTags.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: btnBg,
              border: activeTag
                ? isHighContrast
                  ? '2px solid #000'
                  : '1px solid #818cf8'
                : btnBorder,
              borderRadius: '5px',
              padding: '3px 8px',
            }}
          >
            <select
              aria-label="Filtrar por tag"
              value={activeTag || ''}
              onChange={(e) => setActiveTag(e.target.value || null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTag ? (isHighContrast ? '#000' : '#818cf8') : textColor,
                fontSize: '11px',
                fontWeight: activeTag ? 600 : 400,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: isHighContrast ? '#fff' : isLight ? '#fff' : '#151821', color: textColor }}>
                Todas as tags
              </option>
              {allTags.map((t) => (
                <option key={t} value={t} style={{ background: isHighContrast ? '#fff' : isLight ? '#fff' : '#151821', color: textColor }}>
                  #{t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Alternador de Modo: Edição vs Visualização (Tipografia Limpa) */}
        <div
          role="group"
          aria-label="Modo de Operação"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#141824',
            border: isHighContrast ? '2px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #282f42',
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => setEditorMode('edit')}
            aria-pressed={editorMode === 'edit'}
            title="Modo de Edição (Ctrl+E): Permite criar nós, editar textos e alterar ligações"
            data-testid="mode-edit"
            style={{
              background:
                editorMode === 'edit'
                  ? isHighContrast
                    ? '#000000'
                    : '#4f46e5'
                  : 'transparent',
              color:
                editorMode === 'edit'
                  ? '#ffffff'
                  : isHighContrast
                    ? '#000000'
                    : isLight
                      ? '#64748b'
                      : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: editorMode === 'edit' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Edição</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('view')}
            aria-pressed={editorMode === 'view'}
            title="Modo de Visualização (Ctrl+E): Mapa limpo para leitura sem botões e configurações de edição"
            data-testid="mode-view"
            style={{
              background:
                editorMode === 'view'
                  ? isHighContrast
                    ? '#000000'
                    : '#0284c7'
                  : 'transparent',
              color:
                editorMode === 'view'
                  ? '#ffffff'
                  : isHighContrast
                    ? '#000000'
                    : isLight
                      ? '#64748b'
                      : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: editorMode === 'view' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Visualização</span>
          </button>
        </div>

        {/* Modo Apresentação / Trilha Guiada (Tour Mode) */}
        <button
          type="button"
          onClick={() => (isTourActive ? endTour() : startTour())}
          title={isTourActive ? 'Encerrar Modo Apresentação (Esc)' : 'Iniciar Modo Apresentação / Trilha Guiada'}
          aria-pressed={isTourActive}
          style={{
            background: isTourActive
              ? isHighContrast
                ? '#000000'
                : '#4f46e5'
              : btnBg,
            color: isTourActive ? '#ffffff' : textColor,
            border: btnBorder,
            borderRadius: '5px',
            padding: '4px 9px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>{isTourActive ? 'Sair do Tour' : 'Apresentação'}</span>
        </button>

        {/* Divisor Semântico */}
        <div style={{ width: '1px', height: '18px', backgroundColor: dividerColor }} />

        {/* Undo / Redo (apenas em modo de edição) */}
        {editorMode === 'edit' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z / Cmd+Z)"
              aria-label="Desfazer"
              style={{
                background: btnBg,
                color: canUndo ? textColor : isHighContrast ? '#888888' : '#475569',
                border: btnBorder,
                borderRadius: '5px 0 0 5px',
                padding: '5px 7px',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                opacity: canUndo ? 1 : 0.45,
              }}
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Shift+Z / Cmd+Shift+Z)"
              aria-label="Refazer"
              style={{
                background: btnBg,
                color: canRedo ? textColor : isHighContrast ? '#888888' : '#475569',
                borderTop: btnBorder,
                borderRight: btnBorder,
                borderBottom: btnBorder,
                borderLeft: 'none',
                borderRadius: '0 5px 5px 0',
                padding: '5px 7px',
                cursor: canRedo ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                opacity: canRedo ? 1 : 0.45,
              }}
            >
              <Redo2 size={13} />
            </button>
          </div>
        )}

        {/* Ações de Mutação do Grafo (apenas em modo de edição) */}
        {editorMode === 'edit' && (
          <>
            <button
              type="button"
              onClick={organizeMap}
              title="Distribuir nós e subgrafos no canvas (Auto-layout Dagre)"
              style={{
                background: btnBg,
                color: isHighContrast ? '#000000' : isLight ? '#0369a1' : '#38bdf8',
                border: btnBorder,
                borderRadius: '5px',
                padding: '5px 9px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Organizar Mapa
            </button>

            <button
              type="button"
              onClick={handleCreateRoot}
              title="Criar novo conceito raiz no mapa"
              style={{
                background: isHighContrast ? '#000000' : '#4f46e5',
                color: '#ffffff',
                border: isHighContrast ? '2px solid #000000' : 'none',
                borderRadius: '5px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Plus size={13} />
              <span>Novo Conceito</span>
            </button>
          </>
        )}

        {/* Menu Dropdown de Arquivo (Importar, Exportar, PNG 2x) */}
        <div ref={fileMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsFileMenuOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={isFileMenuOpen}
            aria-label="Menu Arquivo"
            title="Menu de Arquivo: Exportar JSON/PNG 2x e Importar JSON/LaTeX"
            style={{
              background: isFileMenuOpen
                ? isHighContrast
                  ? '#000000'
                  : isLight
                    ? '#e2e8f0'
                    : '#283144'
                : btnBg,
              color: isFileMenuOpen && isHighContrast ? '#ffffff' : textColor,
              border: btnBorder,
              borderRadius: '5px',
              padding: '5px 9px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background-color 0.15s ease',
            }}
          >
            <span>Arquivo</span>
            <ChevronDown
              size={11}
              style={{
                transform: isFileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                opacity: 0.7,
              }}
            />
          </button>

          {/* Inputs de arquivo ocultos acionados pelas opções do menu */}
          <input
            ref={texInputRef}
            type="file"
            accept=".tex"
            onChange={handleImportTex}
            style={{ display: 'none' }}
          />
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />

          {isFileMenuOpen && (
            <div
              role="menu"
              className="epistemap-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '230px',
                backgroundColor: menuBg,
                border: menuBorder,
                borderRadius: '7px',
                boxShadow: menuShadow,
                padding: '6px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {/* Seção Exportar */}
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: menuSectionLabelColor,
                  padding: '4px 8px 2px 8px',
                }}
              >
                Exportar
              </div>

              <button
                type="button"
                role="menuitem"
                className="epistemap-dropdown-item"
                disabled={isExportingImage || nodes.length === 0}
                onClick={() => {
                  setIsFileMenuOpen(false)
                  handleExportPNG()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: textColor,
                  fontSize: '12px',
                  cursor: isExportingImage || nodes.length === 0 ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: isExportingImage || nodes.length === 0 ? 0.5 : 1,
                }}
              >
                <ImageIcon size={14} color="#10b981" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {isExportingImage ? 'Exportando PNG...' : 'Exportar PNG 2x'}
                  </div>
                  <div style={{ fontSize: '10px', color: itemDescColor }}>
                    Imagem HD Retina do mapa
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                className="epistemap-dropdown-item"
                onClick={() => {
                  setIsFileMenuOpen(false)
                  handleExportJSON()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: textColor,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Download size={14} color="#38bdf8" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Exportar JSON</div>
                  <div style={{ fontSize: '10px', color: itemDescColor }}>
                    Backup estruturado completo
                  </div>
                </div>
              </button>

              {/* Seção Importar (apenas em modo de edição) */}
              {editorMode === 'edit' && (
                <>
                  <div
                    style={{
                      height: '1px',
                      backgroundColor: isHighContrast ? '#000000' : isLight ? '#e2e8f0' : '#262d3d',
                      margin: '4px 4px',
                    }}
                  />

                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: menuSectionLabelColor,
                      padding: '4px 8px 2px 8px',
                    }}
                  >
                    Importar
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    className="epistemap-dropdown-item"
                    onClick={() => {
                      setIsFileMenuOpen(false)
                      texInputRef.current?.click()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '6px 8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: textColor,
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <FileCode size={14} color="#818cf8" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>Importar .tex</div>
                      <div style={{ fontSize: '10px', color: itemDescColor }}>
                        Documento LaTeX (.tex)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="epistemap-dropdown-item"
                    onClick={() => {
                      setIsFileMenuOpen(false)
                      jsonInputRef.current?.click()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '6px 8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: textColor,
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Upload size={14} color="#f59e0b" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>Importar JSON</div>
                      <div style={{ fontSize: '10px', color: itemDescColor }}>
                        Restaurar mapa de arquivo .json
                      </div>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Divisor Semântico */}
        <div style={{ width: '1px', height: '18px', backgroundColor: dividerColor }} />

        {isConnected && (
          <button
            type="button"
            onClick={forceReload}
            title={`Cofre local sincronizado: ${vaultPath || '~/notes/epistemap/vault.json'}\nClique para forçar recarga do disco`}
            style={{
              background: btnBg,
              color: textColor,
              border: btnBorder,
              borderRadius: '5px',
              padding: '5px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isSyncing ? '#eab308' : '#22c55e',
                display: 'inline-block',
                boxShadow: isSyncing ? '0 0 6px #eab308' : '0 0 6px #22c55e',
              }}
            />
            <span style={{ fontWeight: 500 }}>{isSyncing ? 'Sincronizando...' : 'Cofre Local'}</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações, Backups e Segurança (Ctrl+,)"
            style={{
              background: btnBg,
              color: isHighContrast ? '#000000' : '#818cf8',
              border: btnBorder,
              borderRadius: '5px',
              padding: '5px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Settings size={13} />
            <span style={{ fontSize: '11px', fontWeight: 500 }}>Config</span>
          </button>
        )}
      </div>
    </header>
  )
}
