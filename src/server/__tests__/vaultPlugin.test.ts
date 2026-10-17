import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { getVaultFilePath, resolveSafeLocalPdfPath, epistemapVaultPlugin } from '../vaultPlugin'
// @ts-expect-error ESM CLI script
import { indexLatexProject, parseSyncTexFile } from '../../../bin/epistemap-cli.mjs'

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

  it('resolveSafeLocalPdfPath deve validar extensão .pdf e existência do arquivo em diretório permitido', () => {
    const validPdf = path.join(tempDir, 'compendio.pdf')
    fs.writeFileSync(validPdf, '%PDF-1.4 mock content', 'utf-8')
    const invalidTxt = path.join(tempDir, 'notas.txt')
    fs.writeFileSync(invalidTxt, 'texto', 'utf-8')

    expect(resolveSafeLocalPdfPath(validPdf)).toBe(validPdf)
    expect(resolveSafeLocalPdfPath(invalidTxt)).toBeNull()
    expect(resolveSafeLocalPdfPath(path.join(tempDir, 'inexistente.pdf'))).toBeNull()
    expect(resolveSafeLocalPdfPath('/etc/passwd')).toBeNull()
  })

  it('POST /api/open-pdf deve validar o PDF local e responder 200 com a página solicitada', async () => {
    const validPdf = path.join(tempDir, 'compendio.pdf')
    fs.writeFileSync(validPdf, '%PDF-1.4 mock content', 'utf-8')

    const plugin = epistemapVaultPlugin({ vaultPath: tempVaultFile })
    let handler: (req: any, res: any, next: () => void) => void = () => {}
    if (typeof plugin.configureServer === 'function') {
      ;(plugin.configureServer as (server: any) => void)({
        middlewares: { use: (fn: any) => (handler = fn) },
      })
    }

    const bodyStr = JSON.stringify({ filePath: validPdf, page: 17 })
    const req: any = {
      url: '/api/open-pdf',
      method: 'POST',
      on: (event: string, cb: any) => {
        if (event === 'data') cb(bodyStr)
        if (event === 'end') cb()
      },
    }

    let status = 0
    let out = ''
    const res: any = {
      setHeader: () => {},
      end: (d: string) => {
        out = d
      },
      set statusCode(c: number) {
        status = c
      },
    }

    await handler(req, res, () => {})
    expect(status).toBe(200)
    const parsed = JSON.parse(out)
    expect(parsed.ok).toBe(true)
    expect(parsed.page).toBe(17)
    expect(parsed.filePath).toBe(validPdf)
  })

  it('indexLatexProject deve indexar main.tex + \\input + .synctex.gz mapeando páginas exatas do PDF', () => {
    const projDir = path.join(tempDir, 'Topologia_Teste')
    const buildDir = path.join(projDir, '.build')
    fs.mkdirSync(buildDir, { recursive: true })

    const mainTex = [
      '\\documentclass[12pt]{article}',
      '\\newcommand{\\nomedisciplina}{Topologia Teste}',
      '\\begin{document}',
      '\\section{Espaços Abertos}',
      '\\input{abertos}',
      '\\end{document}',
    ].join('\n')

    const abertosTex = [
      '\\begin{definicao}',
      'Uma \\textbf{topologia} sobre $X$ é uma coleção $\\tau$.',
      '\\end{definicao}',
      '',
      '\\begin{teorema}[Interseção Finita]',
      '\\label{thm:inter}',
      'A interseção finita de abertos é aberta.',
      '\\end{teorema}',
      '',
      '\\begin{corolario}',
      'Pelo Teorema \\ref{thm:inter}, o resultado segue.',
      '\\end{corolario}',
    ].join('\n')

    fs.writeFileSync(path.join(projDir, 'main.tex'), mainTex, 'utf-8')
    fs.writeFileSync(path.join(projDir, 'abertos.tex'), abertosTex, 'utf-8')
    const pdfFile = path.join(projDir, 'Topologia_Teste.pdf')
    fs.writeFileSync(pdfFile, '%PDF-1.4 fake', 'utf-8')

    const synctexContent = [
      'SyncTeX Version:1',
      `Input:1:${path.join(projDir, 'main.tex')}`,
      `Input:2:${path.join(projDir, './abertos.tex')}`,
      '{3',
      'h2,1:0,0:0,0,0',
      'h2,2:0,0:0,0,0',
      '}',
      '{7',
      'h2,5:0,0:0,0,0',
      'h2,6:0,0:0,0,0',
      '}',
      '{9',
      'h2,10:0,0:0,0,0',
      '}',
    ].join('\n')

    const synctexGzPath = path.join(buildDir, 'main.synctex.gz')
    fs.writeFileSync(synctexGzPath, zlib.gzipSync(Buffer.from(synctexContent, 'utf-8')))

    const syncTex = parseSyncTexFile(synctexGzPath, projDir)
    expect(syncTex.hasSyncTex).toBe(true)
    expect(syncTex.getPage(path.join(projDir, 'abertos.tex'), 1)).toBe(3)
    expect(syncTex.getPage(path.join(projDir, 'abertos.tex'), 5)).toBe(7)
    expect(syncTex.getPage(path.join(projDir, 'abertos.tex'), 10)).toBe(9)

    const result = indexLatexProject(projDir)
    expect(result.disciplineTitle).toBe('Topologia Teste')
    expect(result.hasSyncTex).toBe(true)
    // Raiz + 1 Seção + 3 blocos formais = 5 nós
    expect(result.nodes.length).toBe(5)

    const defNode = result.nodes.find((n: any) => n.data.tags.includes('definicao'))
    const thmNode = result.nodes.find((n: any) => n.data.tags.includes('teorema'))
    const corNode = result.nodes.find((n: any) => n.data.tags.includes('corolario'))

    expect(defNode.data.title).toContain('Definição 1.1 — Topologia')
    expect(defNode.data.pdfAttachment).toEqual({
      name: 'Topologia_Teste.pdf',
      base64: '',
      filePath: pdfFile,
      page: 3,
    })

    expect(thmNode.data.title).toContain('Teorema 1.2 — Interseção Finita')
    expect(thmNode.data.pdfAttachment.page).toBe(7)

    expect(corNode.data.pdfAttachment.page).toBe(9)
    expect(result.edges.length).toBe(1)
    expect(result.edges[0].source).toBe(corNode.id)
    expect(result.edges[0].target).toBe(thmNode.id)
  })
})

