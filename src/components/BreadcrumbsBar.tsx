import React, { useMemo } from 'react'
import { ChevronRight, Home, Plus, Download, Upload, LayoutGrid } from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { getBreadcrumbs } from '../core/graph'

export const BreadcrumbsBar: React.FC = () => {
  const focusId = useGraphStore((s) => s.focusId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const setFocus = useGraphStore((s) => s.setFocus)
  const addRootNode = useGraphStore((s) => s.addRootNode)
  const organizeMap = useGraphStore((s) => s.organizeMap)
  const loadGraph = useGraphStore((s) => s.loadGraph)

  const breadcrumbs = useMemo(() => {
    return getBreadcrumbs(nodes, focusId)
  }, [nodes, focusId])

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
  }

  return (
    <header
      style={{
        height: '52px',
        background: '#12151c',
        borderBottom: '1px solid #262b3a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
        zIndex: 10,
      }}
    >
      {/* Logotipo e Trilha de Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#818cf8', letterSpacing: '-0.3px' }}>
            Epistemap
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#64748b',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '1px 5px',
            }}
          >
            v2.0
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
                {idx > 0 && <ChevronRight size={14} color="#64748b" />}
                <button
                  onClick={() => setFocus(crumb.id)}
                  style={{
                    background: isLast ? '#1e2332' : 'transparent',
                    border: isLast ? '1px solid #3b4259' : 'none',
                    color: isLast ? '#f8fafc' : '#94a3b8',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={organizeMap}
          title="Distribuir nós e subgrafos no canvas (Auto-layout Dagre)"
          style={{
            background: '#1e2433',
            color: '#38bdf8',
            border: '1px solid #2e3e58',
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
          onClick={handleCreateRoot}
          style={{
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
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

        <button
          onClick={handleExportJSON}
          title="Exportar mapa como JSON"
          style={{
            background: '#1e2433',
            color: '#cbd5e1',
            border: '1px solid #333d54',
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
          Exportar
        </button>

        <label
          title="Importar mapa JSON"
          style={{
            background: '#1e2433',
            color: '#cbd5e1',
            border: '1px solid #333d54',
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
      </div>
    </header>
  )
}
