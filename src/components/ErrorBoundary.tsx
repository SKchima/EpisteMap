import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EpisteMap ErrorBoundary capturou um erro:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleResetData = () => {
    try {
      localStorage.removeItem('epistemap:v2')
      localStorage.removeItem('epistemap_state_v1')
    } catch (e) {
      console.warn('Erro ao limpar localStorage:', e)
    }
    window.location.reload()
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
            backgroundColor: '#0d1017',
            color: '#f8fafc',
            fontFamily: "'Inter', sans-serif",
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: '#161922',
              border: '1px solid #7f1d1d',
              borderRadius: '12px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  padding: '10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
                  Ocorreu um erro no EpisteMap
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  A interface encontrou uma inconsistência durante a renderização.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: '#0d1017',
                  border: '1px solid #2d3345',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  fontFamily: 'monospace',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '8px',
              }}
            >
              <button
                type="button"
                onClick={this.handleResetData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#242a3a',
                  border: '1px solid #374151',
                  color: '#cbd5e1',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} /> Restaurar Mapa Inicial
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Recarregar
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
