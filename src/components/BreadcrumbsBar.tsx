import React, { useMemo, useState } from 'react'
import {
  ChevronRight,
  Home,
  Plus,
  Download,
  Upload,
  LayoutGrid,
  Search,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Tag,
  Moon,
  Sun,
  Contrast,
  FileCode,
  Settings,
} from 'lucide-react'
import { getViewportForBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useGraphStore } from '../core/graphStore'
import { getBreadcrumbs } from '../core/graph'
import { buildFlowElements, computeNodeBoundingBoxes } from '../core/layout'
import { parseTexDocument } from '../core/texImporter'

export interface BreadcrumbsBarProps {
  onOpenSearch?: () => void
  onOpenSettings?: () => void
}

export const BreadcrumbsBar: React.FC<BreadcrumbsBarProps> = ({ onOpenSearch, onOpenSettings }) => {
  const focusId = useGraphStore((s) => s.focusId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const activeTag = useGraphStore((s) => s.activeTag)
  const theme = useGraphStore((s) => s.theme)
  const setTheme = useGraphStore((s) => s.setTheme)
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

  const [isExportingImage, setIsExportingImage] = useState(false)

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

  const handleToggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light')
    } else if (theme === 'light') {
      setTheme('high-contrast')
    } else {
      setTheme('dark')
    }
  }

  const headerBg = isHighContrast ? '#ffffff' : isLight ? '#ffffff' : '#12151c'
  const headerBorder = isHighContrast ? '2px solid #000000' : isLight ? '1px solid #e2e8f0' : '1px solid #262b3a'
  const btnBg = isHighContrast ? '#ffffff' : isLight ? '#f1f5f9' : '#191e2c'
  const btnBorder = isHighContrast ? '1.5px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #2e364f'
  const textColor = isHighContrast ? '#000000' : isLight ? '#0f172a' : '#cbd5e1'

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#818cf8', letterSpacing: '-0.3px' }}>
            Epistemap
          </span>
          <span
            style={{
              fontSize: '11px',
              color: isHighContrast ? '#000000' : isLight ? '#475569' : '#64748b',
              border: isHighContrast ? '1.5px solid #000000' : isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              borderRadius: '4px',
              padding: '1px 5px',
            }}
          >
            v2.1
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
              gap: '4px',
              background: btnBg,
              border: activeTag
                ? isHighContrast
                  ? '2px solid #000'
                  : '1px solid #818cf8'
                : btnBorder,
              borderRadius: '5px',
              padding: '3px 7px',
            }}
          >
            <Tag size={12} color={activeTag ? (isHighContrast ? '#000' : '#818cf8') : (isHighContrast ? '#000' : '#64748b')} />
            <select
              aria-label="Filtrar por tag"
              value={activeTag || ''}
              onChange={(e) => setActiveTag(e.target.value || null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTag ? (isHighContrast ? '#000' : '#f8fafc') : textColor,
                fontSize: '11px',
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

        {/* Undo / Redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Desfazer (Ctrl+Z / Cmd+Z)"
            aria-label="Desfazer"
            style={{
              background: btnBg,
              color: canUndo ? textColor : (isHighContrast ? '#888' : '#475569'),
              border: btnBorder,
              borderRadius: '5px 0 0 5px',
              padding: '5px 7px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              opacity: canUndo ? 1 : 0.5,
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
              color: canRedo ? textColor : (isHighContrast ? '#888' : '#475569'),
              borderTop: btnBorder,
              borderRight: btnBorder,
              borderBottom: btnBorder,
              borderLeft: 'none',
              borderRadius: '0 5px 5px 0',
              padding: '5px 7px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              opacity: canRedo ? 1 : 0.5,
            }}
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Seletor de Tema Visual (3 Modos: Escuro, Claro, Alto Contraste Papel) */}
        <button
          type="button"
          onClick={handleToggleTheme}
          title={`Tema: ${theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Alto Contraste Papel'}. Clique para alternar.`}
          aria-label="Alternar tema visual"
          data-testid="theme-toggle"
          style={{
            background: btnBg,
            color: textColor,
            border: btnBorder,
            borderRadius: '5px',
            padding: '5px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {theme === 'dark' && <Moon size={13} color="#818cf8" />}
          {theme === 'light' && <Sun size={13} color="#f59e0b" />}
          {theme === 'high-contrast' && <Contrast size={13} color="#000000" />}
          <span style={{ fontSize: '11px', fontWeight: 500 }}>
            {theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Papel'}
          </span>
        </button>

        <button
          type="button"
          onClick={organizeMap}
          title="Distribuir nós e subgrafos no canvas (Auto-layout Dagre)"
          style={{
            background: btnBg,
            color: isHighContrast ? '#000000' : '#38bdf8',
            border: btnBorder,
            borderRadius: '5px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <LayoutGrid size={13} />
          Organizar Mapa
        </button>

        <button
          type="button"
          onClick={handleCreateRoot}
          style={{
            background: isHighContrast ? '#000000' : '#4f46e5',
            color: '#fff',
            border: isHighContrast ? '2px solid #000000' : 'none',
            borderRadius: '5px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Plus size={14} />
          Novo Conceito
        </button>

        {/* Importador Web direto de .tex */}
        <label
          title="Importar compêndio LaTeX (.tex)"
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
          <FileCode size={13} />
          <span>Importar .tex</span>
          <input
            type="file"
            accept=".tex"
            onChange={handleImportTex}
            style={{ display: 'none' }}
          />
        </label>

        <button
          type="button"
          onClick={handleExportPNG}
          disabled={isExportingImage || nodes.length === 0}
          title="Exportar Grafo Inteiro em PNG Alta Resolução (2x Retina)"
          style={{
            background: btnBg,
            color: isHighContrast ? '#000000' : '#10b981',
            border: btnBorder,
            borderRadius: '5px',
            padding: '5px 8px',
            fontSize: '12px',
            cursor: isExportingImage || nodes.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: isExportingImage || nodes.length === 0 ? 0.6 : 1,
          }}
        >
          <ImageIcon size={13} />
          {isExportingImage ? 'Exportando...' : 'PNG 2x'}
        </button>

        <button
          type="button"
          onClick={handleExportJSON}
          title="Exportar mapa como JSON"
          style={{
            background: btnBg,
            color: textColor,
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
          <Download size={13} />
          JSON
        </button>

        <label
          title="Importar mapa JSON"
          style={{
            background: btnBg,
            color: textColor,
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
          <Upload size={13} />
          Importar
          <input
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />
        </label>

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
