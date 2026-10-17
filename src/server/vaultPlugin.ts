import type { Plugin, Connect, ViteDevServer, PreviewServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface VaultPluginOptions {
  vaultPath?: string
}

export function getVaultFilePath(customPath?: string): string {
  if (customPath) return customPath
  if (process.env.EPISTEMAP_VAULT_PATH) return process.env.EPISTEMAP_VAULT_PATH
  const vaultDir = process.env.EPISTEMAP_VAULT_DIR || path.join(os.homedir(), 'notes', 'epistemap')
  return path.join(vaultDir, 'vault.json')
}

export function resolveSafeLocalPdfPath(rawPath: string | null | undefined): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null
  const trimmed = rawPath.trim()
  if (!trimmed) return null
  const resolved = path.resolve(trimmed)
  if (!resolved.toLowerCase().endsWith('.pdf')) return null

  const homePrefix = path.resolve(os.homedir()) + path.sep
  const tmpPrefix = path.resolve(os.tmpdir()) + path.sep
  if (!resolved.startsWith(homePrefix) && !resolved.startsWith(tmpPrefix)) {
    return null
  }

  try {
    const stat = fs.statSync(resolved)
    if (!stat.isFile()) return null
    return resolved
  } catch {
    return null
  }
}

export function epistemapVaultPlugin(options: VaultPluginOptions = {}): Plugin {
  const vaultFile = getVaultFilePath(options.vaultPath)
  const vaultDir = path.dirname(vaultFile)

  try {
    fs.mkdirSync(vaultDir, { recursive: true })
  } catch {
    // Diretório já existe ou falha não-bloqueante
  }

  const sseClients = new Set<ServerResponse>()
  let lastServerWriteTimestamp = 0
  let watchDebounceTimer: NodeJS.Timeout | null = null
  let activeWatcher: fs.FSWatcher | null = null

  function broadcastVaultUpdate(graphData: unknown) {
    const payload = `event: vault-update\ndata: ${JSON.stringify(graphData)}\n\n`
    for (const client of sseClients) {
      try {
        client.write(payload)
      } catch {
        sseClients.delete(client)
      }
    }
  }

  function startWatcher() {
    if (activeWatcher) return
    try {
      if (fs.existsSync(vaultDir)) {
        activeWatcher = fs.watch(vaultDir, (_eventType, filename) => {
          if (!filename || filename === path.basename(vaultFile)) {
            if (watchDebounceTimer) clearTimeout(watchDebounceTimer)
            watchDebounceTimer = setTimeout(() => {
              if (Date.now() - lastServerWriteTimestamp < 1200) {
                return
              }
              if (fs.existsSync(vaultFile)) {
                try {
                  const raw = fs.readFileSync(vaultFile, 'utf-8')
                  const parsed = JSON.parse(raw)
                  broadcastVaultUpdate(parsed)
                } catch {
                  // Leitura transitória concorrente
                }
              }
            }, 250)
          }
        })
        activeWatcher.unref()
      }
    } catch (err) {
      console.warn('[EpisteMap Vault] Não foi possível iniciar o watcher:', err)
    }
  }

  function stopWatcher() {
    if (activeWatcher) {
      try {
        activeWatcher.close()
      } catch {
        // Ignora
      }
      activeWatcher = null
    }
    if (watchDebounceTimer) {
      clearTimeout(watchDebounceTimer)
      watchDebounceTimer = null
    }
  }

  function setupMiddlewares(middlewares: Connect.Server) {
    middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = req.url || ''

      // SSE: Canal de notificações de alteração de arquivo em tempo real
      if (url === '/api/vault/events' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })
        res.write(`retry: 3000\n`)
        res.write(`data: ${JSON.stringify({ type: 'connected', path: vaultFile })}\n\n`)

        sseClients.add(res)
        req.on('close', () => {
          sseClients.delete(res)
        })
        return
      }

      // GET /api/pdf?path=... : Serve arquivo PDF local diretamente do disco sem embutir Base64 no vault
      if (url.startsWith('/api/pdf') && req.method === 'GET') {
        const parsedUrl = new URL(url, 'http://127.0.0.1')
        const rawPath = parsedUrl.searchParams.get('path')
        const safePdfPath = resolveSafeLocalPdfPath(rawPath)

        if (!safePdfPath) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'pdf_not_found_or_forbidden', path: rawPath }))
          return
        }

        try {
          const stat = fs.statSync(safePdfPath)
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': String(stat.size),
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          })
          const stream = fs.createReadStream(safePdfPath)
          stream.on('error', () => {
            if (!res.headersSent) {
              res.statusCode = 500
            }
            res.end()
          })
          stream.pipe(res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'failed_to_stream_pdf', details: String(err) }))
        }
        return
      }

      // POST /api/open-pdf : Abre o PDF diretamente no Zathura na página exata do conceito
      if (url === '/api/open-pdf' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')

          try {
            const data = JSON.parse(body) as { filePath?: string; page?: number }
            const safePdfPath = resolveSafeLocalPdfPath(data.filePath)
            if (!safePdfPath) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'pdf_not_found_or_forbidden' }))
              return
            }

            const pageNum = Math.max(1, Math.floor(Number(data.page) || 1))
            const child = spawn('zathura', [`--page=${pageNum}`, safePdfPath], {
              detached: true,
              stdio: 'ignore',
            })
            child.on('error', () => {
              // Ignora se zathura não estiver instalado no ambiente de teste
            })
            child.unref()

            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, filePath: safePdfPath, page: pageNum }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'invalid_json', details: String(err) }))
          }
        })
        return
      }

      // GET: Carrega o arquivo vault.json atual
      if (url === '/api/vault' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')

        if (!fs.existsSync(vaultFile)) {
          res.statusCode = 404
          res.end(JSON.stringify({ exists: false, path: vaultFile }))
          return
        }

        try {
          const content = fs.readFileSync(vaultFile, 'utf-8')
          const parsed = JSON.parse(content)
          res.statusCode = 200
          res.end(JSON.stringify({ exists: true, path: vaultFile, graph: parsed }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'failed_to_read_vault', details: String(err) }))
        }
        return
      }

      // POST: Salva o grafo atual no arquivo vault.json
      if (url === '/api/vault' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')

          try {
            const data = JSON.parse(body)
            fs.mkdirSync(vaultDir, { recursive: true })
            lastServerWriteTimestamp = Date.now()
            fs.writeFileSync(vaultFile, JSON.stringify(data.graph || data, null, 2), 'utf-8')

            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, path: vaultFile, timestamp: Date.now() }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'invalid_json', details: String(err) }))
          }
        })
        return
      }

      next()
    })
  }

  function handleServerInit(server: ViteDevServer | PreviewServer) {
    startWatcher()
    setupMiddlewares(server.middlewares)
    if (server.httpServer) {
      server.httpServer.on('close', () => {
        stopWatcher()
      })
    }
  }

  return {
    name: 'epistemap-vault-plugin',
    configureServer(server) {
      handleServerInit(server)
    },
    configurePreviewServer(server) {
      handleServerInit(server)
    },
  }
}
