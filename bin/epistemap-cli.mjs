#!/usr/bin/env node
/**
 * EpisteMap CLI - Utilitário de linha de comando para automação, IA, indexação LaTeX/SyncTeX e manipulação do vault.
 * Permite que agentes (como Antigravity) e scripts consultem, editem e sincronizem compêndios LaTeX com o vault local.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ENV_META = {
  definicao: { tag: 'definicao', defaultTitle: 'Definição', color: '#06b6d4' },
  teorema: { tag: 'teorema', defaultTitle: 'Teorema', color: '#6366f1' },
  proposicao: { tag: 'proposicao', defaultTitle: 'Proposição', color: '#818cf8' },
  lema: { tag: 'lema', defaultTitle: 'Lema', color: '#38bdf8' },
  corolario: { tag: 'corolario', defaultTitle: 'Corolário', color: '#a855f7' },
  exemplo: { tag: 'exemplo', defaultTitle: 'Exemplo', color: '#ec4899' },
  exercicio: { tag: 'exercicio', defaultTitle: 'Exercício', color: '#f59e0b' },
  axioma: { tag: 'axioma', defaultTitle: 'Axioma', color: '#10b981' },
}

const COMPENDIUM_COLORS = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#a855f7',
]

export function getVaultPath() {
  if (process.env.EPISTEMAP_VAULT_PATH) return process.env.EPISTEMAP_VAULT_PATH
  const vaultDir = process.env.EPISTEMAP_VAULT_DIR || path.join(os.homedir(), 'notes', 'epistemap')
  return path.join(vaultDir, 'vault.json')
}

export function loadVault() {
  const file = getVaultPath()
  if (!fs.existsSync(file)) {
    return {
      version: '2.0',
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
    }
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    const graph = parsed.graph || parsed
    return {
      version: '2.0',
      updatedAt: new Date().toISOString(),
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
    }
  } catch (err) {
    console.error(`Erro ao ler o arquivo do vault em ${file}:`, err)
    process.exit(1)
  }
}

export function saveVault(data) {
  const file = getVaultPath()
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  data.updatedAt = new Date().toISOString()
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`Vault salvo com sucesso em: ${file}`)
}

function generateId() {
  return 'node_' + Math.random().toString(36).substring(2, 9)
}

function generateEdgeId() {
  return 'edge_' + Math.random().toString(36).substring(2, 9)
}

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseArgs(args) {
  const flags = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      flags._.push(arg)
    }
  }
  return flags
}

/**
 * Remove comentários LaTeX preservando exatamente o número de quebras de linha (\n)
 * para manter a correspondência exata de linhas com o SyncTeX.
 */
export function stripLatexCommentsPreservingLines(tex) {
  return tex
    .split('\n')
    .map((line) => {
      let out = ''
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && i + 1 < line.length) {
          out += line[i] + line[i + 1]
          i++
          continue
        }
        if (line[i] === '%') break
        out += line[i]
      }
      return out
    })
    .join('\n')
}

export function extractDelimited(text, startIndex, openChar = '{', closeChar = '}') {
  if (startIndex >= text.length || text[startIndex] !== openChar) return null
  let depth = 0
  let i = startIndex
  const startContent = startIndex + 1

  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i += 2
      continue
    }
    if (text[i] === openChar) {
      depth++
    } else if (text[i] === closeChar) {
      depth--
      if (depth === 0) {
        return {
          content: text.substring(startContent, i),
          endIndex: i + 1,
        }
      }
    }
    i++
  }
  return null
}

/**
 * Converte corpo LaTeX para Markdown + KaTeX limpo, substituindo diagramas TikZ/tikz-cd
 * por ponteiros para a página exata do PDF.
 */
export function cleanCompendiumLatex(body, pageNum = 1, labelMap = {}) {
  if (!body) return ''
  let text = body

  // Remover comando \exnum{...} usado apenas para numeração interna
  text = text.replace(/\\exnum\{[^}]*\}/g, '')

  // Substituir diagramas TikZ / tikzcd por nota limpa apontando para o PDF
  text = text.replace(
    /\\begin\{(tikzpicture|tikzcd)\}[\s\S]*?\\end\{\1\}/g,
    `\n> *[Diagrama comutativo/TikZ renderizado no PDF — ver página ${pageNum}]*\n`
  )

  // Converter \begin{proof}[...] ... \end{proof}
  text = text.replace(
    /\\begin\{proof\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{proof\}/g,
    (_m, optTitle, proofBody) => {
      const header = optTitle ? optTitle.trim() : 'Demonstração'
      return `\n\n**${header}:**\n${proofBody.trim()} $\\blacksquare$\n`
    }
  )

  // Normalizar macros incompatíveis com KaTeX padrão (\mathbbm{2} -> \mathbb{2})
  text = text.replace(/\\mathbbm\{([^}]+)\}/g, '\\mathbf{$1}')

  // Equações display
  text = text.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_m, eq) => {
    return `\n$$\n${eq.trim()}\n$$\n`
  })
  text = text.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_m, eq) => {
    return `\n$$\n\\begin{aligned}\n${eq.trim()}\n\\end{aligned}\n$$\n`
  })
  text = text.replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (_m, eq) => {
    return `\n$$\n\\begin{gathered}\n${eq.trim()}\n\\end{gathered}\n$$\n`
  })
  text = text.replace(/\\begin\{multline\*?\}([\s\S]*?)\\end\{multline\*?\}/g, (_m, eq) => {
    return `\n$$\n\\begin{gathered}\n${eq.trim()}\n\\end{gathered}\n$$\n`
  })
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, eq) => {
    return `\n$$\n${eq.trim()}\n$$\n`
  })
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, eq) => {
    return `$${eq.trim()}$`
  })

  // Referências cruzadas -> WikiLinks
  text = text.replace(/\\(?:eq)?ref\{([^}]+)\}/g, (_m, key) => {
    const k = key.trim()
    return `[[${labelMap[k] || k}]]`
  })

  // Links e formatação
  text = text.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '[$2]($1)')
  text = text.replace(/\\url\{([^}]+)\}/g, '[$1]($1)')
  text = text.replace(/``([\s\S]*?)''/g, '"$1"')
  text = text.replace(/''([\s\S]*?)''/g, '"$1"')
  text = text.replace(/\\textbf\{([^{}]+)\}/g, '**$1**')
  text = text.replace(/\\textit\{([^{}]+)\}/g, '*$1*')
  text = text.replace(/\\emph\{([^{}]+)\}/g, '*$1*')
  text = text.replace(/\\underline\{([^{}]+)\}/g, '_$1_')
  text = text.replace(/\\texttt\{([^{}]+)\}/g, '`$1`')
  text = text.replace(/\\textsc\{([^{}]+)\}/g, '$1')

  // Listas itemize / enumerate
  text = text.replace(/\\begin\{(?:itemize|enumerate)\}(?:\[[^\]]*\])?/g, '')
  text = text.replace(/\\end\{(?:itemize|enumerate)\}/g, '')
  text = text.replace(/\\item\s*(?:\[([^\]]*)\])?\s*/g, (_m, opt) => {
    if (opt !== undefined) {
      const cleanedOpt = opt.trim()
      return cleanedOpt ? `\n- **${cleanedOpt}** ` : '\n- '
    }
    return '\n- '
  })

  text = text.replace(/\\label\{[^}]*\}/g, '')
  text = text.replace(/\\cite\{([^}]+)\}/g, '[$1]')
  text = text.replace(/\\(?:par|newpage|clearpage|noindent)\b/g, '\n')
  text = text.replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '')

  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extrai um subtítulo semântico conciso de um bloco formal (ex: termo em \textbf{...}).
 */
function extractSemanticSubtitle(rawBody, optionalBracketTitle) {
  if (optionalBracketTitle && optionalBracketTitle.trim()) {
    return cleanCompendiumLatex(optionalBracketTitle).replace(/\*\*/g, '').trim()
  }

  // Ignorar a demonstração ao buscar o conceito-chave
  const statementOnly = rawBody.split('\\begin{proof}')[0] || rawBody

  // Prioridade 1: Primeiro \textbf{...} no enunciado
  const boldMatch = /\\textbf\{([^{}\n]{2,65})\}/.exec(statementOnly)
  if (boldMatch) {
    const term = boldMatch[1]
      .replace(/\\mathbbm\{([^}]+)\}/g, '\\mathbf{$1}')
      .trim()
    if (term) {
      return term.charAt(0).toUpperCase() + term.slice(1)
    }
  }

  // Prioridade 2: Padrões clássicos em português ("é dito (ser) um(a) X se", "então o(a) X é")
  const patternMatch =
    /(?:é dito(?: ser)?(?: um| uma)?|dizemos que [^\n,;]{1,20} é(?: um| uma)?|então (?:o|a) )\s*([a-záéíóúâêôãõçA-Z0-9\s$-]{3,40}?)(?:\s+se\b|\s+é\b|:|\.)/i.exec(
      statementOnly
    )
  if (patternMatch && patternMatch[1]) {
    const candidate = patternMatch[1].trim()
    if (candidate.length >= 3 && candidate.length <= 42) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1)
    }
  }

  return ''
}

/**
 * Lê e descomprime .build/main.synctex.gz para mapear (arquivo, linha) -> página exata do PDF.
 */
export function parseSyncTexFile(synctexGzPath, projectDir) {
  const fileLineToPage = new Map()
  if (!synctexGzPath || !fs.existsSync(synctexGzPath)) {
    return {
      hasSyncTex: false,
      getPage: (_file, _line, fallback = 1) => fallback,
      getFirstPageForFile: (_file, fallback = 1) => fallback,
    }
  }

  try {
    const compressed = fs.readFileSync(synctexGzPath)
    const raw = zlib.gunzipSync(compressed).toString('utf-8')
    const lines = raw.split('\n')
    const tagToFile = new Map()
    let currentPage = 1

    for (const line of lines) {
      if (line.startsWith('Input:')) {
        const firstColon = line.indexOf(':')
        const secondColon = line.indexOf(':', firstColon + 1)
        if (secondColon !== -1) {
          const tag = line.slice(firstColon + 1, secondColon)
          const rawFile = line.slice(secondColon + 1).trim()
          const resolved = path.resolve(projectDir, rawFile)
          tagToFile.set(tag, resolved)
        }
        continue
      }

      const pageMatch = /^\{(\d+)$/.exec(line)
      if (pageMatch) {
        currentPage = parseInt(pageMatch[1], 10)
        continue
      }

      const recMatch = /^[[(khgx$](\d+),(\d+):/.exec(line)
      if (recMatch) {
        const tag = recMatch[1]
        const lineNum = parseInt(recMatch[2], 10)
        const file = tagToFile.get(tag)
        if (file && lineNum > 0) {
          let map = fileLineToPage.get(file)
          if (!map) {
            map = new Map()
            fileLineToPage.set(file, map)
          }
          if (!map.has(lineNum)) {
            map.set(lineNum, currentPage)
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Aviso: Falha ao processar SyncTeX (${synctexGzPath}):`, err.message)
  }

  return {
    hasSyncTex: fileLineToPage.size > 0,
    getPage(filePath, targetLine, fallback = 1) {
      const resolved = path.resolve(filePath)
      const map = fileLineToPage.get(resolved)
      if (!map || map.size === 0) return fallback
      if (map.has(targetLine)) return map.get(targetLine)

      let bestDelta = Infinity
      let bestPage = fallback
      for (const [ln, pg] of map.entries()) {
        const delta = Math.abs(ln - targetLine)
        if (delta < bestDelta) {
          bestDelta = delta
          bestPage = pg
        }
      }
      return bestPage
    },
    getFirstPageForFile(filePath, fallback = 1) {
      const resolved = path.resolve(filePath)
      const map = fileLineToPage.get(resolved)
      if (!map || map.size === 0) return fallback
      let minLine = Infinity
      let page = fallback
      for (const [ln, pg] of map.entries()) {
        if (ln < minLine) {
          minLine = ln
          page = pg
        }
      }
      return page
    },
  }
}

/**
 * Localiza ou compila o PDF e o SyncTeX de um projeto LaTeX.
 */
function ensureProjectArtifacts(projectDir, shouldCompile = false) {
  const baseName = path.basename(projectDir)
  const namedPdf = path.join(projectDir, `${baseName}.pdf`)
  const buildPdf = path.join(projectDir, '.build', 'main.pdf')
  const rootMainPdf = path.join(projectDir, 'main.pdf')
  const synctexPath = path.join(projectDir, '.build', 'main.synctex.gz')

  const hasPdf = fs.existsSync(namedPdf) || fs.existsSync(buildPdf) || fs.existsSync(rootMainPdf)
  const hasSyncTex = fs.existsSync(synctexPath)

  if ((shouldCompile || !hasPdf || !hasSyncTex) && fs.existsSync(path.join(projectDir, 'main.tex'))) {
    console.log(`Compilando projeto LaTeX com SyncTeX em: ${projectDir} ...`)
    const res = spawnSync(
      'latexmk',
      ['-synctex=1', '-interaction=nonstopmode', '-file-line-error', '-pdf', '-outdir=.build', 'main.tex'],
      { cwd: projectDir, encoding: 'utf-8', timeout: 120000 }
    )
    if (res.status === 0 && fs.existsSync(buildPdf) && !fs.existsSync(namedPdf)) {
      try {
        fs.copyFileSync(buildPdf, namedPdf)
      } catch {
        // Ignora falha de cópia secundária
      }
    }
  }

  let finalPdfPath = null
  if (fs.existsSync(namedPdf)) finalPdfPath = namedPdf
  else if (fs.existsSync(buildPdf)) finalPdfPath = buildPdf
  else if (fs.existsSync(rootMainPdf)) finalPdfPath = rootMainPdf
  else {
    const anyPdf = fs.readdirSync(projectDir).find((f) => f.toLowerCase().endsWith('.pdf'))
    if (anyPdf) finalPdfPath = path.join(projectDir, anyPdf)
  }

  return {
    pdfPath: finalPdfPath,
    synctexPath: fs.existsSync(synctexPath) ? synctexPath : null,
  }
}

function getLineNumberAtOffset(text, offset) {
  let lines = 1
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') lines++
  }
  return lines
}

/**
 * Indexa um compêndio LaTeX (main.tex + \input + .synctex.gz) gerando nós e arestas
 * com deep-linking para a página exata do PDF local.
 */
export function indexLatexProject(targetPath, options = {}) {
  const resolvedTarget = path.resolve(targetPath)
  const isDir = fs.statSync(resolvedTarget).isDirectory()
  const projectDir = isDir ? resolvedTarget : path.dirname(resolvedTarget)
  const mainTexPath = isDir ? path.join(projectDir, 'main.tex') : resolvedTarget

  if (!fs.existsSync(mainTexPath)) {
    throw new Error(`Arquivo main.tex não encontrado em: ${mainTexPath}`)
  }

  const { pdfPath, synctexPath } = ensureProjectArtifacts(projectDir, Boolean(options.compile))
  const syncTex = parseSyncTexFile(synctexPath, projectDir)
  const pdfName = pdfPath ? path.basename(pdfPath) : `${path.basename(projectDir)}.pdf`

  const rawMain = fs.readFileSync(mainTexPath, 'utf-8')
  const cleanMain = stripLatexCommentsPreservingLines(rawMain)

  // Extrair nome da disciplina
  let disciplineTitle = path.basename(projectDir).replace(/_/g, ' ')
  const discMatch = /\\newcommand\{\\nomedisciplina\}\{([^}]+)\}/.exec(cleanMain)
  if (discMatch && discMatch[1].trim()) {
    disciplineTitle = discMatch[1].trim()
  }

  const compSlug = `comp_${slugify(disciplineTitle)}`
  const compColor = options.color || COMPENDIUM_COLORS[0]
  const rootPos = options.position || { x: 80, y: 80 }

  const nodes = []
  const edges = []

  const rootAttachment = pdfPath
    ? { name: pdfName, base64: '', filePath: pdfPath, page: 1 }
    : null

  nodes.push({
    id: compSlug,
    parentId: null,
    position: rootPos,
    data: {
      title: disciplineTitle,
      description: `Compêndio de **${disciplineTitle}** sincronizado a partir de \`${projectDir}\`.\n\n- **PDF vinculado**: \`${pdfName}\`\n- Clique em qualquer seção ou bloco formal para abrir a página exata no leitor ou no **Zathura**.`,
      tags: ['compendio', slugify(disciplineTitle)],
      color: compColor,
      collapsed: false,
      ...(rootAttachment ? { pdfAttachment: rootAttachment } : {}),
    },
  })

  let sectionCounter = 0
  let subsectionCounter = 0
  let theoremCounter = 0
  let currentSectionNode = null
  let currentSubsectionNode = null

  const envNames = Object.keys(ENV_META).join('|')
  const tokenRegex = new RegExp(
    `\\\\(section|subsection)\\*?\\s*(?:\\[[^\\]]*\\])?\\s*\\{|\\\\input\\s*\\{([^}]+)\\}|\\\\begin\\s*\\{(${envNames})\\*?\\}`,
    'gi'
  )

  const labelToNode = new Map()
  const pendingRefs = []

  function walkTexFile(filePath, isMainFile = false) {
    if (!fs.existsSync(filePath)) return
    const rawText = fs.readFileSync(filePath, 'utf-8')
    const cleanText = stripLatexCommentsPreservingLines(rawText)

    let scanStart = 0
    let scanEnd = cleanText.length
    if (isMainFile) {
      const docStartIdx = cleanText.indexOf('\\begin{document}')
      if (docStartIdx !== -1) {
        scanStart = docStartIdx + '\\begin{document}'.length
      }
      const docEndIdx = cleanText.indexOf('\\end{document}', scanStart)
      if (docEndIdx !== -1) {
        scanEnd = docEndIdx
      }
    }

    const localRegex = new RegExp(tokenRegex.source, 'gi')
    localRegex.lastIndex = scanStart

    let match
    while ((match = localRegex.exec(cleanText)) !== null) {
      if (match.index >= scanEnd) break
      const matchStart = match.index
      const lineNum = getLineNumberAtOffset(cleanText, matchStart)

      // 1. \section ou \subsection
      if (match[1]) {
        const secKind = match[1].toLowerCase()
        const braceIdx = matchStart + match[0].length - 1
        const extracted = extractDelimited(cleanText, braceIdx, '{', '}')
        if (!extracted) continue

        const secTitle = cleanCompendiumLatex(extracted.content)
        const secPage = syncTex.getPage(
          filePath,
          lineNum,
          currentSectionNode?.data?.pdfAttachment?.page || 1
        )

        if (secKind === 'section') {
          sectionCounter++
          subsectionCounter = 0
          theoremCounter = 0

          const secId = `${compSlug}_sec_${sectionCounter}`
          const secNode = {
            id: secId,
            parentId: compSlug,
            position: { x: 0, y: 0 },
            data: {
              title: `${sectionCounter}. ${secTitle}`,
              description: `Seção ${sectionCounter} do compêndio de **${disciplineTitle}**: *${secTitle}*.`,
              tags: ['secao', slugify(disciplineTitle)],
              color: null,
              collapsed: true,
              ...(pdfPath
                ? {
                    pdfAttachment: {
                      name: pdfName,
                      base64: '',
                      filePath: pdfPath,
                      page: secPage,
                    },
                  }
                : {}),
            },
          }
          nodes.push(secNode)
          currentSectionNode = secNode
          currentSubsectionNode = null
        } else {
          subsectionCounter++
          const subsecId = `${compSlug}_sec_${sectionCounter}_sub_${subsectionCounter}`
          const subsecNode = {
            id: subsecId,
            parentId: currentSectionNode ? currentSectionNode.id : compSlug,
            position: { x: 0, y: 0 },
            data: {
              title: `${sectionCounter}.${subsectionCounter} ${secTitle}`,
              description: `Subseção ${sectionCounter}.${subsectionCounter}: *${secTitle}*.`,
              tags: ['subsecao'],
              color: null,
              collapsed: true,
              ...(pdfPath
                ? {
                    pdfAttachment: {
                      name: pdfName,
                      base64: '',
                      filePath: pdfPath,
                      page: secPage,
                    },
                  }
                : {}),
            },
          }
          nodes.push(subsecNode)
          currentSubsectionNode = subsecNode
        }

        localRegex.lastIndex = extracted.endIndex
        continue
      }

      // 2. \input{...}
      if (match[2]) {
        const rawInput = match[2].trim()
        const inputRel = rawInput.endsWith('.tex') ? rawInput : `${rawInput}.tex`
        const inputFullPath = path.resolve(path.dirname(filePath), inputRel)

        if (currentSectionNode && currentSectionNode.data.pdfAttachment) {
          const firstFilePage = syncTex.getFirstPageForFile(inputFullPath, 0)
          if (firstFilePage > 0 && currentSectionNode.data.pdfAttachment.page <= 2) {
            currentSectionNode.data.pdfAttachment.page = firstFilePage
          }
        }

        walkTexFile(inputFullPath, false)
        continue
      }

      // 3. \begin{definicao|teorema|...}
      if (match[3]) {
        const rawEnv = match[3].toLowerCase()
        const meta = ENV_META[rawEnv]
        if (!meta) continue

        let cursor = matchStart + match[0].length
        while (cursor < scanEnd && /\s/.test(cleanText[cursor])) cursor++

        let optTitle = ''
        if (cleanText[cursor] === '[') {
          const opt = extractDelimited(cleanText, cursor, '[', ']')
          if (opt) {
            optTitle = opt.content
            cursor = opt.endIndex
          }
        }

        const endRegex = new RegExp(`\\\\end\\{${rawEnv}\\*?\\}`, 'i')
        const endMatch = endRegex.exec(cleanText.slice(cursor, scanEnd))
        if (!endMatch) continue

        const bodyEnd = cursor + endMatch.index
        const rawBody = cleanText.slice(cursor, bodyEnd)

        theoremCounter++
        let itemNumber = `${sectionCounter || 1}.${theoremCounter}`
        const exnumMatch = /\\exnum\{([^}]+)\}/.exec(rawBody)
        if (exnumMatch) {
          itemNumber = exnumMatch[1].trim()
          theoremCounter--
        }

        const fallbackPage = currentSectionNode?.data?.pdfAttachment?.page || 1
        const itemPage = syncTex.getPage(filePath, lineNum, fallbackPage)

        // Atualiza página da seção se ainda estava na capa/sumário
        if (
          currentSectionNode?.data?.pdfAttachment &&
          currentSectionNode.data.pdfAttachment.page <= 2 &&
          itemPage > 2
        ) {
          currentSectionNode.data.pdfAttachment.page = itemPage
        }

        const subtitle = extractSemanticSubtitle(rawBody, optTitle)
        const fullTitle = subtitle
          ? `${meta.defaultTitle} ${itemNumber} — ${subtitle}`
          : `${meta.defaultTitle} ${itemNumber}`

        const itemId = `${compSlug}_${meta.tag}_${slugify(itemNumber)}_${nodes.length}`
        const parentId =
          currentSubsectionNode?.id || currentSectionNode?.id || compSlug

        // Capturar \label{...} se houver
        const labelMatch = /\\label\{([^}]+)\}/.exec(rawBody)
        if (labelMatch) {
          labelToNode.set(labelMatch[1].trim(), { id: itemId, title: fullTitle })
        }

        // Capturar \ref{...} para criar arestas semânticas depois
        const refMatches = rawBody.matchAll(/\\(?:eq)?ref\{([^}]+)\}/g)
        for (const rm of refMatches) {
          pendingRefs.push({ sourceId: itemId, refKey: rm[1].trim() })
        }

        const cleanedMd = cleanCompendiumLatex(rawBody, itemPage)
        const footer = pdfPath
          ? `\n\n---\n*Fonte: \`${pdfName}\` — Página ${itemPage}*`
          : ''

        nodes.push({
          id: itemId,
          parentId,
          position: { x: 0, y: 0 },
          data: {
            title: fullTitle,
            description: `${cleanedMd}${footer}`,
            tags: [meta.tag, slugify(disciplineTitle)],
            color: meta.color,
            collapsed: false,
            ...(pdfPath
              ? {
                  pdfAttachment: {
                    name: pdfName,
                    base64: '',
                    filePath: pdfPath,
                    page: itemPage,
                  },
                }
              : {}),
          },
        })

        localRegex.lastIndex = bodyEnd + endMatch[0].length
      }
    }
  }

  walkTexFile(mainTexPath, true)

  // Resolver referências cruzadas (\label -> \ref) em arestas
  for (const ref of pendingRefs) {
    const target = labelToNode.get(ref.refKey)
    if (target && target.id !== ref.sourceId) {
      edges.push({
        id: `edge_${ref.sourceId}_${target.id}`,
        source: ref.sourceId,
        target: target.id,
        label: 'referencia',
      })
    }
  }

  return {
    compSlug,
    disciplineTitle,
    pdfPath,
    hasSyncTex: syncTex.hasSyncTex,
    nodes,
    edges,
  }
}

/**
 * Mescla os nós e arestas de um compêndio no vault preservando outros compêndios/notas manuais.
 */
export function mergeCompendiumIntoVault(vault, indexedResult) {
  const { compSlug, nodes: newNodes, edges: newEdges } = indexedResult
  const prefix = `${compSlug}_`

  const oldNodeMap = new Map(vault.nodes.map((n) => [n.id, n]))

  // Preservar posição raiz customizada se o compêndio já existia no vault
  const existingRoot = oldNodeMap.get(compSlug)
  if (existingRoot && existingRoot.position) {
    newNodes[0].position = existingRoot.position
  }

  // Remover versão anterior apenas deste compêndio
  const keptNodes = vault.nodes.filter(
    (n) => n.id !== compSlug && !n.id.startsWith(prefix)
  )
  const newIds = new Set([...keptNodes.map((n) => n.id), ...newNodes.map((n) => n.id)])

  const keptEdges = vault.edges.filter(
    (e) =>
      !e.id.startsWith(`edge_${compSlug}`) &&
      newIds.has(e.source) &&
      newIds.has(e.target)
  )

  vault.nodes = [...keptNodes, ...newNodes]
  vault.edges = [...keptEdges, ...newEdges]
  return vault
}

/**
 * Descobre todos os compêndios em um diretório raiz (ex: latex-projects) que usam preamble_compendio.tex.
 */
export function discoverCompendiumProjects(latexProjectsRoot) {
  const results = []
  function scan(dir, depth = 0) {
    if (depth > 3 || !fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const candidateMain = path.join(fullPath, 'main.tex')
        if (fs.existsSync(candidateMain)) {
          const content = fs.readFileSync(candidateMain, 'utf-8')
          if (content.includes('preamble_compendio.tex')) {
            results.push(fullPath)
            continue
          }
        }
        scan(fullPath, depth + 1)
      }
    }
  }
  scan(latexProjectsRoot, 0)
  return results.sort()
}

function runCli() {
  const [command, ...args] = process.argv.slice(2)

  switch (command) {
    case 'status': {
      const vault = loadVault()
      const file = getVaultPath()
      console.log(`EpisteMap Vault Status:`)
      console.log(`  Arquivo: ${file}`)
      console.log(`  Nós: ${vault.nodes.length}`)
      console.log(`  Arestas: ${vault.edges.length}`)
      console.log(`  Última atualização: ${vault.updatedAt || 'N/A'}`)
      break
    }

    case 'list': {
      const vault = loadVault()
      console.log(`\n=== Conceitos no EpisteMap Vault (${vault.nodes.length} nós) ===\n`)
      const roots = vault.nodes.filter((n) => !n.parentId)
      const byParent = new Map()
      for (const n of vault.nodes) {
        if (n.parentId) {
          if (!byParent.has(n.parentId)) byParent.set(n.parentId, [])
          byParent.get(n.parentId).push(n)
        }
      }

      function printTree(node, indent = 0) {
        const pad = '  '.repeat(indent)
        const tags = node.data?.tags?.length ? ` [${node.data.tags.join(', ')}]` : ''
        const pageInfo = node.data?.pdfAttachment?.page ? ` (p.${node.data.pdfAttachment.page})` : ''
        console.log(`${pad}• ${node.data?.title || 'Sem título'}${pageInfo} (id: ${node.id})${tags}`)
        const children = byParent.get(node.id) || []
        for (const child of children) {
          printTree(child, indent + 1)
        }
      }

      for (const root of roots) {
        printTree(root, 0)
      }

      if (vault.edges.length > 0) {
        console.log(`\n=== Conexões Semânticas (${vault.edges.length} arestas) ===\n`)
        const nodeMap = new Map(vault.nodes.map((n) => [n.id, n.data?.title || n.id]))
        for (const e of vault.edges) {
          const src = nodeMap.get(e.source) || e.source
          const tgt = nodeMap.get(e.target) || e.target
          const lbl = e.label ? ` --[${e.label}]--> ` : ' ----> '
          console.log(`  ${src}${lbl}${tgt}`)
        }
      }
      console.log('')
      break
    }

    case 'add': {
      const flags = parseArgs(args)
      const title = flags.title || 'Novo Conceito'
      const desc = flags.desc || flags.description || ''
      const tags = flags.tags ? flags.tags.split(',').map((t) => t.trim()) : []
      const color = flags.color || null

      const vault = loadVault()
      let parentId = null

      if (flags.parent) {
        const parentNode = vault.nodes.find(
          (n) => n.id === flags.parent || n.data?.title?.toLowerCase() === flags.parent.toLowerCase()
        )
        if (parentNode) {
          parentId = parentNode.id
        } else {
          console.warn(`Aviso: Nó pai "${flags.parent}" não encontrado. Criando como conceito raiz.`)
        }
      }

      const newNodeId = generateId()
      const newNode = {
        id: newNodeId,
        parentId,
        position: { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 },
        data: {
          title,
          description: desc,
          tags,
          color,
          collapsed: false,
        },
      }

      vault.nodes.push(newNode)
      saveVault(vault)
      console.log(`Conceito "${title}" adicionado com sucesso (id: ${newNodeId}).`)
      break
    }

    case 'connect': {
      const flags = parseArgs(args)
      if (!flags.source || !flags.target) {
        console.error('Uso: epistemap-cli connect --source "<nome ou id>" --target "<nome ou id>" [--label "relação"]')
        process.exit(1)
      }

      const vault = loadVault()
      const srcNode = vault.nodes.find(
        (n) => n.id === flags.source || n.data?.title?.toLowerCase() === flags.source.toLowerCase()
      )
      const tgtNode = vault.nodes.find(
        (n) => n.id === flags.target || n.data?.title?.toLowerCase() === flags.target.toLowerCase()
      )

      if (!srcNode || !tgtNode) {
        console.error(`Erro: Não foi possível localizar ambos os nós (${flags.source} -> ${flags.target}).`)
        process.exit(1)
      }

      const edgeId = generateEdgeId()
      vault.edges.push({
        id: edgeId,
        source: srcNode.id,
        target: tgtNode.id,
        label: flags.label || '',
      })

      saveVault(vault)
      console.log(`Aresta criada: "${srcNode.data.title}" -> "${tgtNode.data.title}" (id: ${edgeId}).`)
      break
    }

    case 'get': {
      const flags = parseArgs(args)
      const query = flags.title || flags.id || flags._[0]
      if (!query) {
        console.error('Uso: epistemap-cli get --title "<título>" ou --id "<id>"')
        process.exit(1)
      }
      const vault = loadVault()
      const node = vault.nodes.find(
        (n) => n.id === query || n.data?.title?.toLowerCase() === query.toLowerCase()
      )
      if (!node) {
        console.error(`Nó "${query}" não encontrado.`)
        process.exit(1)
      }
      console.log(JSON.stringify(node, null, 2))
      break
    }

    case 'index-latex': {
      const flags = parseArgs(args)
      const targetPath = flags.path || flags._[0]
      if (!targetPath) {
        console.error('Uso: epistemap-cli index-latex <caminho-do-projeto-ou-main.tex> [--compile]')
        process.exit(1)
      }

      const vault = loadVault()
      const existingRoots = vault.nodes.filter((n) => !n.parentId).length
      const result = indexLatexProject(targetPath, {
        compile: Boolean(flags.compile),
        color: COMPENDIUM_COLORS[existingRoots % COMPENDIUM_COLORS.length],
        position: {
          x: 80 + (existingRoots % 2) * 920,
          y: 80 + Math.floor(existingRoots / 2) * 620,
        },
      })

      mergeCompendiumIntoVault(vault, result)
      saveVault(vault)
      console.log(
        `Compêndio "${result.disciplineTitle}" indexado: ${result.nodes.length} nós (PDF: ${result.pdfPath || 'não encontrado'}, SyncTeX: ${result.hasSyncTex ? 'ativo' : 'inativo'}).`
      )
      break
    }

    case 'sync-compendios': {
      const flags = parseArgs(args)
      const rootDir =
        flags.root ||
        flags._[0] ||
        path.join(os.homedir(), 'repos', 'ygg', 'latex-projects')

      const projects = discoverCompendiumProjects(rootDir)
      if (projects.length === 0) {
        console.error(`Nenhum compêndio encontrado em: ${rootDir}`)
        process.exit(1)
      }

      const vault = flags.clean
        ? { version: '2.0', updatedAt: new Date().toISOString(), nodes: [], edges: [] }
        : loadVault()

      console.log(`Encontrados ${projects.length} compêndios em ${rootDir}:`)
      projects.forEach((projDir, idx) => {
        const result = indexLatexProject(projDir, {
          compile: Boolean(flags.compile),
          color: COMPENDIUM_COLORS[idx % COMPENDIUM_COLORS.length],
          position: {
            x: 80 + (idx % 2) * 920,
            y: 80 + Math.floor(idx / 2) * 620,
          },
        })
        mergeCompendiumIntoVault(vault, result)
        console.log(
          `  [${idx + 1}/${projects.length}] ${result.disciplineTitle}: ${result.nodes.length} nós (PDF: ${result.pdfPath ? path.basename(result.pdfPath) : 'N/A'}, SyncTeX: ${result.hasSyncTex ? 'OK' : 'N/A'})`
        )
      })

      saveVault(vault)
      console.log(`Sincronização concluída: ${vault.nodes.length} nós totais no vault.`)
      break
    }

    default:
      console.log(`
EpisteMap CLI - Gestão, Indexação LaTeX/SyncTeX e Automação de Vault

Comandos disponíveis:
  status                                                     Exibe status e caminho do vault ativo
  list                                                       Lista a árvore de conceitos e páginas
  add --title "<nome>" [--parent "<pai>"] [--desc "<md>"]    Adiciona novo nó
  connect --source "<origem>" --target "<destino>"           Cria uma conexão semântica
  get --title "<nome>" / --id "<id>"                         Retorna os detalhes de um nó em JSON
  index-latex <dir-ou-main.tex> [--compile]                  Indexa um compêndio LaTeX + SyncTeX no vault
  sync-compendios [--root "<dir>"] [--compile] [--clean]     Sincroniza todos os compêndios de latex-projects

Variáveis de ambiente suportadas:
  EPISTEMAP_VAULT_PATH   Caminho exato para o vault.json
  EPISTEMAP_VAULT_DIR    Diretório base do vault (padrão: ~/notes/epistemap)
`)
      break
  }
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  runCli()
}
