import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getVaultFilePath, epistemapVaultPlugin } from '../vaultPlugin'

describe('EpisteMap Vault Plugin & Sync Server', () => {
  const tempDir = path.join(os.tmpdir(), `epistemap-test-vault-${Date.now()}`)
  const tempVaultFile = path.join(tempDir, 'vault.json')

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Cleanup
    }
  })

  it('getVaultFilePath deve priorizar caminho customizado ou variável de ambiente', () => {
    expect(getVaultFilePath('/custom/vault.json')).toBe('/custom/vault.json')

    process.env.EPISTEMAP_VAULT_PATH = '/env/vault.json'
    expect(getVaultFilePath()).toBe('/env/vault.json')
    delete process.env.EPISTEMAP_VAULT_PATH

    process.env.EPISTEMAP_VAULT_DIR = '/env/dir'
    expect(getVaultFilePath()).toBe('/env/dir/vault.json')
    delete process.env.EPISTEMAP_VAULT_DIR
  })

  it('deve responder 404 em GET /api/vault quando o arquivo ainda não existir', async () => {
    const plugin = epistemapVaultPlugin({ vaultPath: tempVaultFile })
    let handler: (req: any, res: any, next: () => void) => void = () => {}

    const mockServer = {
      middlewares: {
        use: (fn: any) => {
          handler = fn
        },
      },
    }

    if (typeof plugin.configureServer === 'function') {
      ;(plugin.configureServer as (server: any) => void)(mockServer)
    }

    const req = { url: '/api/vault', method: 'GET' }
    let responseData = ''
    let statusCode = 0

    const res = {
      setHeader: () => {},
      end: (data: string) => {
        responseData = data
      },
      set statusCode(code: number) {
        statusCode = code
      },
    }

    await handler(req, res, () => {})

    expect(statusCode).toBe(404)
    const parsed = JSON.parse(responseData)
    expect(parsed.exists).toBe(false)
  })

  it('deve salvar grafo com sucesso em POST /api/vault e retornar 200 em GET subsequente', async () => {
    const plugin = epistemapVaultPlugin({ vaultPath: tempVaultFile })
    let handler: (req: any, res: any, next: () => void) => void = () => {}

    const mockServer = {
      middlewares: {
        use: (fn: any) => {
          handler = fn
        },
      },
    }

    if (typeof plugin.configureServer === 'function') {
      ;(plugin.configureServer as (server: any) => void)(mockServer)
    }

    // POST /api/vault
    const postPayload = JSON.stringify({
      graph: {
        nodes: [{ id: 'n1', parentId: null, position: { x: 0, y: 0 }, data: { title: 'Teste' } }],
        edges: [],
      },
    })

    const postReq: any = {
      url: '/api/vault',
      method: 'POST',
      on: (event: string, cb: any) => {
        if (event === 'data') cb(postPayload)
        if (event === 'end') cb()
      },
    }

    let postStatus = 0
    let postData = ''
    const postRes: any = {
      setHeader: () => {},
      end: (data: string) => {
        postData = data
      },
      set statusCode(code: number) {
        postStatus = code
      },
    }

    await handler(postReq, postRes, () => {})
    expect(postStatus).toBe(200)
    expect(JSON.parse(postData).ok).toBe(true)
    expect(fs.existsSync(tempVaultFile)).toBe(true)

    // GET /api/vault
    const getReq = { url: '/api/vault', method: 'GET' }
    let getStatus = 0
    let getData = ''
    const getRes: any = {
      setHeader: () => {},
      end: (data: string) => {
        getData = data
      },
      set statusCode(code: number) {
        getStatus = code
      },
    }

    await handler(getReq, getRes, () => {})
    expect(getStatus).toBe(200)
    const retrieved = JSON.parse(getData)
    expect(retrieved.exists).toBe(true)
    expect(retrieved.graph.nodes[0].data.title).toBe('Teste')
  })
})
