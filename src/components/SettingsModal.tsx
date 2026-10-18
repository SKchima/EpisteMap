import React, { useState, useEffect } from 'react'
import {
  X,
  Settings,
  ShieldCheck,
  Download,
  Upload,
  Camera,
  RotateCcw,
  Trash2,
  Palette,
  HardDrive,
  AlertTriangle,
  Keyboard,
} from 'lucide-react'
import { useGraphStore } from '../core/graphStore'
import { initialSeedNodes, initialSeedEdges } from '../core/seedData'
import {
  createBackupFilename,
  prepareGraphForExport,
  downloadJsonFile,
  getLocalSnapshots,
  saveLocalSnapshot,
  deleteLocalSnapshot,
  parseBackupFile,
  type LocalSnapshot,
} from '../core/backup'
import type { ThemeMode } from '../core/types'

export type SettingsTab = 'backup' | 'theme' | 'shortcuts' | 'security' | 'danger'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = 'backup' }) => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const theme = useGraphStore((s) => s.theme)
  const setTheme = useGraphStore((s) => s.setTheme)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const resetGraph = useGraphStore((s) => s.resetGraph)

  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    setActiveTab(initialTab)
  }

  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>(() => getLocalSnapshots())
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Backup Completo (com PDFs embutidos)
  const handleExportFull = () => {
    const filename = createBackupFilename('epistemap-backup', true)
    const data = prepareGraphForExport(nodes, edges, { includePdfs: true })
    downloadJsonFile(filename, data)
    showNotification(`Backup completo exportado: ${filename}`)
  }

  // Backup Leve (sem Base64 de PDFs, ideal para versionamento git)
  const handleExportLight = () => {
    const filename = createBackupFilename('epistemap-backup', false)
    const data = prepareGraphForExport(nodes, edges, { includePdfs: false })
    downloadJsonFile(filename, data)
    showNotification(`Backup leve exportado: ${filename}`)
  }

  // Criar Snapshot Local no navegador
  const handleCreateSnapshot = () => {
    const label = snapshotLabel.trim() || `Snapshot (${nodes.length} nós)`
    const newSnap = saveLocalSnapshot(nodes, edges, label)
    if (newSnap) {
      setSnapshots(getLocalSnapshots())
      setSnapshotLabel('')
      showNotification('Snapshot criado com sucesso no histórico local!')
    }
  }

  // Restaurar Snapshot
  const handleRestoreSnapshot = (snap: LocalSnapshot) => {
    if (confirm(`Restaurar o mapa mental para o estado "${snap.label}" de ${snap.isoDate}? As alterações não salvas serão substituídas.`)) {
      loadGraph(snap.graph)
      showNotification(`Mapa restaurado para "${snap.label}".`)
      onClose()
    }
  }

  // Excluir Snapshot
  const handleDeleteSnapshot = (id: string) => {
    const updated = deleteLocalSnapshot(id)
    setSnapshots(updated)
  }

  // Importar arquivo JSON de backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const graph = parseBackupFile(text)
        loadGraph(graph)
        showNotification(`Backup importado com sucesso! (${graph.nodes.length} nós carregados)`)
        onClose()
      } catch (err) {
        alert('Erro ao restaurar backup: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Restaurar dados semente
  const handleResetToSeed = () => {
    if (confirm('Restaurar o mapa para o exemplo padrão inicial? O mapa atual será substituído.')) {
      loadGraph({ nodes: initialSeedNodes, edges: initialSeedEdges })
      showNotification('Mapa de exemplo restaurado.')
      onClose()
    }
  }

  // Esvaziar mapa
  const handleClearAll = () => {
    if (confirm('ATENÇÃO: Deseja apagar TODOS os nós e arestas do mapa mental? Esta ação limpará a tela.')) {
      resetGraph()
      showNotification('Mapa completamente esvaziado.')
      onClose()
    }
  }

  // Cálculo de estatísticas e peso aproximado
  const totalPdfCount = nodes.filter((n) => Boolean(n.data.pdfAttachment?.base64)).length
  const storageEstimatedBytes = new Blob([localStorage.getItem('epistemap:v2') || '']).size
  const storageEstimatedKB = Math.round(storageEstimatedBytes / 1024)

  const isLight = theme === 'light'
  const isPaper = theme === 'high-contrast'

  const modalBg = isPaper ? '#ffffff' : isLight ? '#f8fafc' : '#141824'
  const sidebarBg = isPaper ? '#f4f4f5' : isLight ? '#f1f5f9' : '#0e111a'
  const textColor = isPaper ? '#000000' : isLight ? '#0f172a' : '#f8fafc'
  const subtextColor = isPaper ? '#333333' : isLight ? '#475569' : '#94a3b8'
  const borderColor = isPaper ? '#000000' : isLight ? '#cbd5e1' : '#282f42'
  const cardBg = isPaper ? '#ffffff' : isLight ? '#ffffff' : '#1a1f2e'
  const borderRule = isPaper ? '2px solid #000000' : `1px solid ${borderColor}`

  const kbdStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    fontFamily: 'monospace',
    padding: '2px 5px',
    borderRadius: isPaper ? '0' : '4px',
    background: isPaper ? '#f4f4f5' : isLight ? '#e2e8f0' : '#202637',
    color: textColor,
    border: isPaper ? '1px solid #000' : isLight ? '1px solid #cbd5e1' : '1px solid #333d56',
    boxShadow: isPaper ? '1px 1px 0 #000' : '0 1px 1px rgba(0,0,0,0.2)',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações e Backups"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '780px',
          maxWidth: '100%',
          maxHeight: '90vh',
          backgroundColor: modalBg,
          color: textColor,
          borderRadius: isPaper ? '0px' : '10px',
          border: borderRule,
          boxShadow: isPaper ? '8px 8px 0px #000000' : '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: borderRule,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: sidebarBg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color={isPaper ? '#000000' : '#818cf8'} />
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, letterSpacing: '-0.2px' }}>
              Configurações & Gestão de Backups
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: 'none',
              color: subtextColor,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Notificação Temporária */}
        {feedbackMsg && (
          <div
            style={{
              padding: '8px 20px',
              backgroundColor: isPaper ? '#e5e7eb' : 'rgba(99, 102, 241, 0.2)',
              borderBottom: borderRule,
              fontSize: '12px',
              fontWeight: 600,
              color: isPaper ? '#000000' : '#c7d2fe',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>✓</span> {feedbackMsg}
          </div>
        )}

        {/* Corpo: Abas + Conteúdo */}
        <div style={{ display: 'flex', flex: 1, minHeight: '440px', overflow: 'hidden' }}>
          {/* Navegação Lateral de Abas */}
          <div
            style={{
              width: '200px',
              backgroundColor: sidebarBg,
              borderRight: borderRule,
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setActiveTab('backup')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: isPaper ? '0' : '6px',
                border: isPaper && activeTab === 'backup' ? '2px solid #000' : 'none',
                background: activeTab === 'backup' ? (isPaper ? '#fff' : '#262d40') : 'transparent',
                color: activeTab === 'backup' ? (isPaper ? '#000' : '#fff') : subtextColor,
                fontWeight: activeTab === 'backup' ? 600 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <HardDrive size={15} /> Backups & Snapshots
            </button>

            <button
              onClick={() => setActiveTab('theme')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: isPaper ? '0' : '6px',
                border: isPaper && activeTab === 'theme' ? '2px solid #000' : 'none',
                background: activeTab === 'theme' ? (isPaper ? '#fff' : '#262d40') : 'transparent',
                color: activeTab === 'theme' ? (isPaper ? '#000' : '#fff') : subtextColor,
                fontWeight: activeTab === 'theme' ? 600 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Palette size={15} /> Temas & Visual
            </button>

            <button
              onClick={() => setActiveTab('shortcuts')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: isPaper ? '0' : '6px',
                border: isPaper && activeTab === 'shortcuts' ? '2px solid #000' : 'none',
                background: activeTab === 'shortcuts' ? (isPaper ? '#fff' : '#262d40') : 'transparent',
                color: activeTab === 'shortcuts' ? (isPaper ? '#000' : '#fff') : subtextColor,
                fontWeight: activeTab === 'shortcuts' ? 600 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Keyboard size={15} /> Atalhos de Teclado
            </button>

            <button
              onClick={() => setActiveTab('security')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: isPaper ? '0' : '6px',
                border: isPaper && activeTab === 'security' ? '2px solid #000' : 'none',
                background: activeTab === 'security' ? (isPaper ? '#fff' : '#262d40') : 'transparent',
                color: activeTab === 'security' ? (isPaper ? '#000' : '#fff') : subtextColor,
                fontWeight: activeTab === 'security' ? 600 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <ShieldCheck size={15} /> Segurança & Local-First
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setActiveTab('danger')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: isPaper ? '0' : '6px',
                border: isPaper && activeTab === 'danger' ? '2px solid #ef4444' : 'none',
                background: activeTab === 'danger' ? (isPaper ? '#fff' : '#391c22') : 'transparent',
                color: '#ef4444',
                fontWeight: activeTab === 'danger' ? 600 : 500,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={15} /> Zona de Perigo
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            {activeTab === 'backup' && (
              <div>
                <h3 style={{ fontSize: '14px', margin: '0 0 6px 0', fontWeight: 600 }}>
                  Backups Eficientes & Snapshots
                </h3>
                <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  Exporte o mapa mental com segurança ou salve snapshots locais para reverter alterações instantaneamente.
                </p>

                {/* Bloco de Exportação */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div
                    style={{
                      background: cardBg,
                      border: borderRule,
                      borderRadius: isPaper ? '0' : '8px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Download size={14} color="#38bdf8" /> Backup Leve (.json)
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor, lineHeight: 1.4, marginBottom: '12px' }}>
                        Ideal para <strong>versionamento em repositórios Git</strong>. Inclui todos os nós, conexões, equações LaTeX e metadados, mantendo tamanho reduzido (&lt; 50 KB).
                      </div>
                    </div>
                    <button
                      onClick={handleExportLight}
                      style={{
                        padding: '6px 12px',
                        background: isPaper ? '#000' : '#232b3e',
                        color: isPaper ? '#fff' : '#38bdf8',
                        border: borderRule,
                        borderRadius: isPaper ? '0' : '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Exportar Backup Leve
                    </button>
                  </div>

                  <div
                    style={{
                      background: cardBg,
                      border: borderRule,
                      borderRadius: isPaper ? '0' : '8px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Download size={14} color="#818cf8" /> Backup Completo (.json)
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor, lineHeight: 1.4, marginBottom: '12px' }}>
                        Arquivo 100% auto-contido. Inclui todo o grafo <strong>mais todos os PDFs embutidos em Base64</strong> para restauração total e portabilidade independente.
                      </div>
                    </div>
                    <button
                      onClick={handleExportFull}
                      style={{
                        padding: '6px 12px',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: isPaper ? '0' : '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Exportar Backup Completo
                    </button>
                  </div>
                </div>

                {/* Criar Snapshot Local */}
                <div
                  style={{
                    background: cardBg,
                    border: borderRule,
                    borderRadius: isPaper ? '0' : '8px',
                    padding: '14px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} color="#10b981" /> Criar Snapshot Local Rápido
                  </div>
                  <div style={{ fontSize: '11px', color: subtextColor, marginBottom: '10px' }}>
                    Grava um ponto de restauração instantâneo na memória local do navegador para desfazer edições complexas.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Identificador (ex: Antes de refatorar álgebra)"
                      value={snapshotLabel}
                      onChange={(e) => setSnapshotLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSnapshot()
                      }}
                      style={{
                        flex: 1,
                        background: isPaper ? '#fff' : '#10141f',
                        border: borderRule,
                        color: textColor,
                        borderRadius: isPaper ? '0' : '4px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleCreateSnapshot}
                      style={{
                        padding: '6px 14px',
                        background: isPaper ? '#000' : '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: isPaper ? '0' : '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Salvar Snapshot
                    </button>
                  </div>
                </div>

                {/* Lista de Snapshots */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      Histórico de Snapshots Recentes ({snapshots.length})
                    </span>
                    <label
                      style={{
                        fontSize: '11px',
                        color: isPaper ? '#000' : '#38bdf8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                      }}
                    >
                      <Upload size={12} /> Restaurar de arquivo .json
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportFile}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  {snapshots.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        fontSize: '11px',
                        color: subtextColor,
                        border: isPaper ? '1px dashed #000' : '1px dashed #334155',
                        borderRadius: isPaper ? '0' : '6px',
                      }}
                    >
                      Nenhum snapshot salvo ainda. Crie um acima para manter pontos de restauração.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {snapshots.map((snap) => (
                        <div
                          key={snap.id}
                          style={{
                            background: cardBg,
                            border: borderRule,
                            borderRadius: isPaper ? '0' : '6px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600 }}>{snap.label}</div>
                            <div style={{ fontSize: '10px', color: subtextColor }}>
                              {snap.isoDate} • {snap.nodeCount} conceitos • {snap.edgeCount} conexões
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleRestoreSnapshot(snap)}
                              style={{
                                padding: '4px 8px',
                                background: isPaper ? '#000' : '#232b3e',
                                color: isPaper ? '#fff' : '#38bdf8',
                                border: borderRule,
                                borderRadius: isPaper ? '0' : '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <RotateCcw size={10} /> Restaurar
                            </button>
                            <button
                              onClick={() => handleDeleteSnapshot(snap.id)}
                              style={{
                                padding: '4px 6px',
                                background: 'transparent',
                                color: '#ef4444',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              title="Excluir snapshot"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div>
                <h3 style={{ fontSize: '14px', margin: '0 0 6px 0', fontWeight: 600 }}>
                  Aparência & Temas Visuais
                </h3>
                <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0' }}>
                  Escolha a paleta visual mais adequada ao seu ambiente de estudo ou trabalho.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    {
                      id: 'dark' as ThemeMode,
                      title: 'Tema Escuro (Padrão)',
                      desc: 'Fundo escuro profundo (#0d1017) relaxante para os olhos e ideal para longas sessões de modelagem.',
                      previewBg: '#0d1017',
                      previewBorder: '#282f42',
                      previewText: '#f8fafc',
                    },
                    {
                      id: 'light' as ThemeMode,
                      title: 'Tema Claro',
                      desc: 'Fundo neutro claro (#f8fafc) e cartões brancos para uso diurno com alta clareza.',
                      previewBg: '#f8fafc',
                      previewBorder: '#cbd5e1',
                      previewText: '#0f172a',
                    },
                    {
                      id: 'high-contrast' as ThemeMode,
                      title: 'Alto Contraste Papel / Impresso',
                      desc: 'Branco puro (#ffffff), bordas pretas sólidas (2px #000) e texto em preto absoluto (WCAG AAA). Ideal para impressões, artigos acadêmicos e exportação de diagramas para relatórios LaTeX.',
                      previewBg: '#ffffff',
                      previewBorder: '#000000',
                      previewText: '#000000',
                    },
                  ].map((t) => {
                    const isSelected = theme === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        style={{
                          background: cardBg,
                          border: isSelected ? (isPaper ? '3px solid #000' : '2px solid #6366f1') : borderRule,
                          borderRadius: isPaper ? '0' : '8px',
                          padding: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {t.title}
                            {isSelected && (
                              <span style={{ fontSize: '10px', background: '#6366f1', color: '#fff', padding: '1px 6px', borderRadius: '4px' }}>
                                Ativo
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: subtextColor, marginTop: '2px', lineHeight: 1.4 }}>
                            {t.desc}
                          </div>
                        </div>

                        {/* Mini preview de amostra de cores */}
                        <div
                          style={{
                            width: '48px',
                            height: '32px',
                            background: t.previewBg,
                            border: `2px solid ${t.previewBorder}`,
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            color: t.previewText,
                          }}
                        >
                          Aa
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div>
                <h3 style={{ fontSize: '14px', margin: '0 0 6px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Keyboard size={16} color={isPaper ? '#000000' : '#818cf8'} /> Atalhos de Teclado
                </h3>
                <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0' }}>
                  Comandos para navegação, criação hierárquica e histórico de alterações.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '480px', overflowY: 'auto' }}>
                  {/* Grupo: Navegação & Canvas */}
                  <div style={{ background: cardBg, border: borderRule, borderRadius: isPaper ? '0' : '8px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: textColor }}>
                      Navegação &amp; Foco
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0', width: '220px' }}>
                            <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>K</kbd> / <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>K</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Busca global de conceitos, tags e texto
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0', width: '220px' }}>
                            <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>E</kbd> / <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>E</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Alternar entre Modo de Edição e Modo de Visualização
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0', width: '220px' }}>
                            <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>\</kbd> / <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>\</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Recolher ou expandir Inspetor de Conhecimento lateral
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>Esc</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Limpar seleção ativa ou subir um nível no drill-down
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0' }}>
                            <span style={{ fontWeight: 500 }}>Duplo clique no canvas</span>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Criar novo conceito raiz nas coordenadas do cursor
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>M</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Alternar exibição do minimapa flutuante (radar)
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>←</kbd> / <kbd style={kbdStyle}>→</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Navegar pelo passo anterior ou próximo no Modo Apresentação (Tour)
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>?</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Abrir este painel de atalhos
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Grupo: Estrutura & Edição */}
                  <div style={{ background: cardBg, border: borderRule, borderRadius: isPaper ? '0' : '8px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: textColor }}>
                      Estrutura &amp; Nós
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0', width: '220px' }}>
                            <kbd style={kbdStyle}>Tab</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Criar sub-conceito filho dentro do nó selecionado
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>Enter</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Criar conceito irmão (mesmo pai que o nó selecionado)
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>Delete</kbd> / <kbd style={kbdStyle}>Backspace</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Excluir conceito ou aresta (com confirmação se possuir filhos)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Grupo: Histórico & Configurações */}
                  <div style={{ background: cardBg, border: borderRule, borderRadius: isPaper ? '0' : '8px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: textColor }}>
                      Histórico &amp; Sistema
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0', width: '220px' }}>
                            <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>Z</kbd> / <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Z</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Desfazer última alteração (Undo)
                          </td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${isPaper ? '#e5e7eb' : '#232a3d'}` }}>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>⇧</kbd> + <kbd style={kbdStyle}>Z</kbd> / <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Y</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Refazer alteração (Redo)
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 0' }}>
                            <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>,</kbd> / <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>,</kbd>
                          </td>
                          <td style={{ padding: '6px 0', color: subtextColor }}>
                            Abrir Configurações e Gestão de Backups
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h3 style={{ fontSize: '14px', margin: '0 0 6px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="#10b981" /> Auditoria de Segurança & Local-First
                </h3>
                <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  O EpisteMap foi projetado com a filosofia estrita de <strong>Zero Cloud &amp; Zero Tracking</strong>.
                </p>

                <div style={{ background: cardBg, border: borderRule, borderRadius: isPaper ? '0' : '8px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px' }}>
                    Diagnóstico de Privacidade
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: subtextColor, lineHeight: 1.8 }}>
                    <li><strong>Sem Conexões Externas:</strong> A aplicação não envia nenhum dado para servidores ou nuvem. Tudo roda 100% no motor local do seu navegador.</li>
                    <li><strong>Armazenamento Local Isolado:</strong> Os dados residem exclusivamente no <code>localStorage</code> do perfil da sua máquina (<code>~/.local/state/epistemap/</code>).</li>
                    <li><strong>Zero Telemetria / Cookies:</strong> Nenhum cookie de rastreamento, Google Analytics ou telemetria existe no código.</li>
                  </ul>
                </div>

                <div style={{ background: cardBg, border: borderRule, borderRadius: isPaper ? '0' : '8px', padding: '14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                    Separação: Código-Fonte vs Dados e Mapas Pessoais
                  </div>
                  <div style={{ fontSize: '11px', color: subtextColor, lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      <strong>Arquitetura local-first e privacidade dos seus dados:</strong>
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '18px' }}>
                      <li>O repositório do EpisteMap contém <strong>apenas o código da aplicação e testes automatizados</strong>. Nenhum mapa pessoal é gravado dentro do código-fonte.</li>
                      <li>Para versionar ou sincronizar seus mapas de estudo de forma privada, exporte o <strong>Backup Leve (.json)</strong> para uma pasta ou repositório de sua preferência, ou conecte um diretório local seguro via vault.</li>
                      <li>Os testes automatizados utilizam exclusivamente dados sintéticos e abstratos para validação da integridade de software.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'danger' && (
              <div>
                <h3 style={{ fontSize: '14px', margin: '0 0 6px 0', fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> Zona de Perigo
                </h3>
                <p style={{ fontSize: '12px', color: subtextColor, margin: '0 0 16px 0' }}>
                  Ações de redefinição de dados. Tenha certeza de ter um backup antes de prosseguir.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: cardBg,
                      border: isPaper ? '2px solid #ef4444' : '1px solid #5a2e38',
                      borderRadius: isPaper ? '0' : '8px',
                      padding: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: textColor }}>
                        Restaurar Mapa de Exemplo
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor, marginTop: '2px' }}>
                        Substitui o mapa atual pelo grafo padrão demonstrativo (Álgebra, Geometria e Teoria da Computação).
                      </div>
                    </div>
                    <button
                      onClick={handleResetToSeed}
                      style={{
                        padding: '6px 12px',
                        background: '#232b3e',
                        color: '#cbd5e1',
                        border: borderRule,
                        borderRadius: isPaper ? '0' : '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Restaurar Exemplo
                    </button>
                  </div>

                  <div
                    style={{
                      background: isPaper ? '#fff' : '#2f1f24',
                      border: isPaper ? '2px solid #ef4444' : '1px solid #7f1d1d',
                      borderRadius: isPaper ? '0' : '8px',
                      padding: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#ef4444' }}>
                        Limpar Todo o Mapa
                      </div>
                      <div style={{ fontSize: '11px', color: subtextColor, marginTop: '2px' }}>
                        Remove permanentemente todos os nós, conexões e arquivos anexados da tela.
                      </div>
                    </div>
                    <button
                      onClick={handleClearAll}
                      style={{
                        padding: '6px 14px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: isPaper ? '0' : '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Apagar Tudo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: borderRule,
            backgroundColor: sidebarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: subtextColor,
          }}
        >
          <div>
            Espaço ocupado em disco: <strong>~{storageEstimatedKB} KB</strong> • PDFs anexados: <strong>{totalPdfCount}</strong>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '5px 14px',
              background: isPaper ? '#000' : '#232838',
              color: isPaper ? '#fff' : '#cbd5e1',
              border: borderRule,
              borderRadius: isPaper ? '0' : '4px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
