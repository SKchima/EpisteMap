import type { KnowledgeNode, KnowledgeEdge, Graph } from './types'
import { applyDagreLayout } from './layout'

export const THEOREM_ENV_META: Record<
  string,
  { tag: string; defaultTitle: string; color: string }
> = {
  definicao: { tag: 'definicao', defaultTitle: 'Definição', color: '#06b6d4' },
  definição: { tag: 'definicao', defaultTitle: 'Definição', color: '#06b6d4' },
  definition: { tag: 'definicao', defaultTitle: 'Definição', color: '#06b6d4' },

  teorema: { tag: 'teorema', defaultTitle: 'Teorema', color: '#6366f1' },
  theorem: { tag: 'teorema', defaultTitle: 'Teorema', color: '#6366f1' },

  lema: { tag: 'lema', defaultTitle: 'Lema', color: '#38bdf8' },
  lemma: { tag: 'lema', defaultTitle: 'Lema', color: '#38bdf8' },

  proposicao: { tag: 'proposicao', defaultTitle: 'Proposição', color: '#818cf8' },
  proposição: { tag: 'proposicao', defaultTitle: 'Proposição', color: '#818cf8' },
  proposition: { tag: 'proposicao', defaultTitle: 'Proposição', color: '#818cf8' },

  corolario: { tag: 'corolario', defaultTitle: 'Corolário', color: '#a855f7' },
  corolário: { tag: 'corolario', defaultTitle: 'Corolário', color: '#a855f7' },
  corollary: { tag: 'corolario', defaultTitle: 'Corolário', color: '#a855f7' },

  exemplo: { tag: 'exemplo', defaultTitle: 'Exemplo', color: '#ec4899' },
  example: { tag: 'exemplo', defaultTitle: 'Exemplo', color: '#ec4899' },

  exercicio: { tag: 'exercicio', defaultTitle: 'Exercício', color: '#f59e0b' },
  exercício: { tag: 'exercicio', defaultTitle: 'Exercício', color: '#f59e0b' },
  exercise: { tag: 'exercicio', defaultTitle: 'Exercício', color: '#f59e0b' },

  demonstracao: { tag: 'demonstracao', defaultTitle: 'Demonstração', color: '#64748b' },
  demonstração: { tag: 'demonstracao', defaultTitle: 'Demonstração', color: '#64748b' },
  proof: { tag: 'demonstracao', defaultTitle: 'Demonstração', color: '#64748b' },

  observacao: { tag: 'observacao', defaultTitle: 'Observação', color: '#0ea5e9' },
  observação: { tag: 'observacao', defaultTitle: 'Observação', color: '#0ea5e9' },
  remark: { tag: 'observacao', defaultTitle: 'Observação', color: '#0ea5e9' },
  obs: { tag: 'observacao', defaultTitle: 'Observação', color: '#0ea5e9' },

  nota: { tag: 'nota', defaultTitle: 'Nota', color: '#64748b' },
  note: { tag: 'nota', defaultTitle: 'Nota', color: '#64748b' },

  propriedade: { tag: 'propriedade', defaultTitle: 'Propriedade', color: '#8b5cf6' },
  property: { tag: 'propriedade', defaultTitle: 'Propriedade', color: '#8b5cf6' },

  axioma: { tag: 'axioma', defaultTitle: 'Axioma', color: '#6366f1' },
  axiom: { tag: 'axioma', defaultTitle: 'Axioma', color: '#6366f1' },
  postulado: { tag: 'axioma', defaultTitle: 'Postulado', color: '#6366f1' },
  postulate: { tag: 'axioma', defaultTitle: 'Postulado', color: '#6366f1' },
}

function generateTexNodeId(prefix: string): string {
  return `tex_${prefix}_` + Math.random().toString(36).substring(2, 8)
}

/**
 * Extrai conteúdo delimitado balanceando delimitadores abertos e fechados
 */
export function extractDelimited(
  text: string,
  startIndex: number,
  openChar = '{',
  closeChar = '}'
): { content: string; endIndex: number } | null {
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
 * Remove comentários LaTeX sem desmanchar porcentagens escapadas (\%)
 */
export function stripLatexComments(tex: string): string {
  const lines = tex.split('\n')
  return lines
    .map((line) => {
      let result = ''
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && i + 1 < line.length) {
          result += line[i] + line[i + 1]
          i++
          continue
        }
        if (line[i] === '%') {
          break
        }
        result += line[i]
      }
      return result
    })
    .join('\n')
}

/**
 * Converte comandos e ambientes LaTeX para Markdown + KaTeX mantendo equações
 */
export function cleanLatexBody(body: string, labelMap?: Record<string, string>): string {
  if (!body) return ''

  let text = body

  // Converter blocos de equações para formato KaTeX ($$ ... $$)
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

  // Display math unnumbered: \[ ... \]
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, eq) => {
    return `\n$$\n${eq.trim()}\n$$\n`
  })

  // Inline math: \( ... \)
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, eq) => {
    return `$${eq.trim()}$`
  })

  // Converter referências \ref{...} e \eqref{...} para formato de Wiki-Links do Epistemap [[...]]
  text = text.replace(/\\(?:eq)?ref\{([^}]+)\}/g, (_m, key) => {
    const trimmed = key.trim()
    const targetTitle = labelMap?.[trimmed] || trimmed
    return `[[${targetTitle}]]`
  })

  // Links externos: \href{url}{text} e \url{url}
  text = text.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '[$2]($1)')
  text = text.replace(/\\url\{([^}]+)\}/g, '[$1]($1)')

  // Aspas tipográficas LaTeX: ``texto'' -> "texto", `texto' -> 'texto' (antes de \texttt)
  text = text.replace(/``([\s\S]*?)''/g, '"$1"')
  text = text.replace(/`([^`'\n]+)'/g, "'$1'")

  // Converter formatação tipográfica básica preservando expressões matemáticas
  text = text.replace(/\\textbf\{([^{}]+)\}/g, '**$1**')
  text = text.replace(/\\textit\{([^{}]+)\}/g, '*$1*')
  text = text.replace(/\\emph\{([^{}]+)\}/g, '*$1*')
  text = text.replace(/\\underline\{([^{}]+)\}/g, '_$1_')
  text = text.replace(/\\texttt\{([^{}]+)\}/g, '`$1`')
  text = text.replace(/\\textsc\{([^{}]+)\}/g, '$1')

  // Listas: \item[opt] -> - opt e \item -> -
  text = text.replace(/\\item\s*(?:\[([^\]]*)\])?\s*/g, (_m, opt) => (opt ? `- ${opt} ` : '- '))
  text = text.replace(/\\begin\{(?:itemize|enumerate)\}/g, '')
  text = text.replace(/\\end\{(?:itemize|enumerate)\}/g, '')

  // Travessões tipográficos LaTeX: --- -> —, -- -> –
  text = text.replace(/---/g, '—')
  text = text.replace(/--/g, '–')

  // Símbolos de prova / QED
  text = text.replace(/\\(?:qed|blacksquare|qedhere)\b/g, '■')

  // Limpeza de comandos utilitários do LaTeX
  text = text.replace(/\\label\{[^}]*\}/g, '')
  text = text.replace(/\\cite\{([^}]+)\}/g, '[$1]')
  text = text.replace(/\\(?:par|newpage|clearpage|noindent)/g, '\n')
  text = text.replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '')
  text = text.replace(/\\rule\{[^}]*\}\{[^}]*\}/g, '')

  // Remove múltiplos espaços e quebras em excesso
  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extrai título do documento LaTeX (\title{...} ou comentário principal)
 */
export function extractDocumentTitle(tex: string): string | null {
  const clean = stripLatexComments(tex)
  const titleMatch = /\\title\s*\{/.exec(clean)
  if (titleMatch) {
    const braceIdx = titleMatch.index + titleMatch[0].length - 1
    const res = extractDelimited(clean, braceIdx, '{', '}')
    if (res && res.content.trim()) {
      return cleanLatexBody(res.content).trim()
    }
  }
  return null
}

/**
 * Parser de documento .tex para nós e arestas do Epistemap
 */
/**
 * Parser de documento .tex para nós e arestas do Epistemap
 */
export function parseTexDocument(rawTex: string): {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
} {
  const cleanTex = stripLatexComments(rawTex)

  // Extrair o corpo dentro de \begin{document} se existir
  let content = cleanTex
  const docStart = cleanTex.indexOf('\\begin{document}')
  if (docStart !== -1) {
    const afterStart = cleanTex.substring(docStart + '\\begin{document}'.length)
    const docEnd = afterStart.indexOf('\\end{document}')
    content = docEnd !== -1 ? afterStart.substring(0, docEnd) : afterStart
  }

  const nodes: KnowledgeNode[] = []
  const edges: KnowledgeEdge[] = []

  const docTitle = extractDocumentTitle(cleanTex)
  let currentChapterId: string | null = null
  let currentSectionId: string | null = null
  let currentSubsectionId: string | null = null
  let currentSubsubsectionId: string | null = null
  let fallbackRootId: string | null = null

  // Mapa de referências cruzadas (\label -> título do conceito)
  const labelMap: Record<string, string> = {}

  function getOrCreateFallbackRoot(): string {
    if (fallbackRootId) return fallbackRootId
    fallbackRootId = generateTexNodeId('root')
    nodes.push({
      id: fallbackRootId,
      parentId: null,
      position: { x: 100, y: 100 },
      data: {
        title: docTitle || 'Documento TeX',
        description: 'Conceito raiz gerado automaticamente a partir de arquivo LaTeX.',
        tags: ['latex', 'compendio'],
        color: '#6366f1',
        collapsed: false,
        pdfAttachment: null,
      },
    })
    return fallbackRootId
  }

  // Regex para encontrar APENAS tokens estruturais relevantes (capítulos, seções e ambientes de teoremas)
  // Preserva equações, matrizes e listas dentro do corpo do texto
  const envPattern = Object.keys(THEOREM_ENV_META).join('|')
  const tokenRegex = new RegExp(
    `\\\\(chapter|section|subsection|subsubsection)\\*?\\s*(?:\\[[^\\]]*\\])?\\s*\\{|\\\\begin\\s*\\{(${envPattern})\\*?\\}`,
    'gi'
  )

  // Pass 1: Mapear \label para títulos para resolução de \ref
  const labelPreScanRegex = new RegExp(
    `\\\\(?:(chapter|section|subsection|subsubsection)\\*?\\s*(?:\\[[^\\]]*\\])?\\s*\\{([^}]+)\\}|begin\\s*\\{(?:${envPattern})\\*?\\}\\s*(?:\\[([^\\]]+)\\])?)[^\\\\]*?\\\\label\\{([^}]+)\\}`,
    'gi'
  )
  let preMatch: RegExpExecArray | null
  while ((preMatch = labelPreScanRegex.exec(content)) !== null) {
    const titleCandidate = preMatch[2] || preMatch[3]
    const labelKey = preMatch[4]
    if (titleCandidate && labelKey) {
      labelMap[labelKey.trim()] = cleanLatexBody(titleCandidate).trim()
    }
  }

  let lastIndex = 0
  let match: RegExpExecArray | null
  let pendingContainerId: string | null = null

  while ((match = tokenRegex.exec(content)) !== null) {
    const matchStart = match.index
    const precedingText = content.substring(lastIndex, matchStart)

    // Se havia texto introdutório antes deste token, anexa à descrição do contêiner anterior
    if (pendingContainerId && precedingText.trim()) {
      const targetNode = nodes.find((n) => n.id === pendingContainerId)
      if (targetNode) {
        const cleaned = cleanLatexBody(precedingText, labelMap)
        if (cleaned) {
          targetNode.data.description = targetNode.data.description
            ? `${targetNode.data.description}\n\n${cleaned}`
            : cleaned
        }
      }
    }

    if (match[1]) {
      const secType = match[1].toLowerCase()
      const openBraceIndex = matchStart + match[0].length - 1
      const extracted = extractDelimited(content, openBraceIndex, '{', '}')

      if (extracted) {
        const title =
          cleanLatexBody(extracted.content, labelMap) ||
          (secType === 'chapter'
            ? 'Capítulo'
            : secType === 'subsection' || secType === 'subsubsection'
              ? 'Subseção'
              : 'Seção')

        if (secType === 'chapter') {
          const id = generateTexNodeId('chap')
          nodes.push({
            id,
            parentId: null,
            position: { x: 100, y: 100 },
            data: {
              title,
              description: '',
              tags: ['capitulo'],
              color: '#6366f1',
              collapsed: false,
              pdfAttachment: null,
            },
          })
          currentChapterId = id
          currentSectionId = null
          currentSubsectionId = null
          currentSubsubsectionId = null
          pendingContainerId = id
        } else if (secType === 'section') {
          const id = generateTexNodeId('sec')
          const parentId = currentChapterId
          nodes.push({
            id,
            parentId,
            position: { x: 100, y: 100 },
            data: {
              title,
              description: '',
              tags: ['secao'],
              color: '#6366f1',
              collapsed: false,
              pdfAttachment: null,
            },
          })
          currentSectionId = id
          currentSubsectionId = null
          currentSubsubsectionId = null
          pendingContainerId = id
        } else if (secType === 'subsection') {
          const id = generateTexNodeId('subsec')
          const parentId = currentSectionId || currentChapterId || getOrCreateFallbackRoot()
          nodes.push({
            id,
            parentId,
            position: { x: 0, y: 0 },
            data: {
              title,
              description: '',
              tags: ['subsecao'],
              color: null,
              collapsed: false,
              pdfAttachment: null,
            },
          })
          currentSubsectionId = id
          currentSubsubsectionId = null
          pendingContainerId = id
        } else {
          // subsubsection
          const id = generateTexNodeId('subsubsec')
          const parentId =
            currentSubsectionId || currentSectionId || currentChapterId || getOrCreateFallbackRoot()
          nodes.push({
            id,
            parentId,
            position: { x: 0, y: 0 },
            data: {
              title,
              description: '',
              tags: ['subsecao'],
              color: null,
              collapsed: false,
              pdfAttachment: null,
            },
          })
          currentSubsubsectionId = id
          pendingContainerId = id
        }

        lastIndex = extracted.endIndex
        tokenRegex.lastIndex = extracted.endIndex
        continue
      }
    }

    if (match[2]) {
      const rawEnv = match[2].toLowerCase().replace(/\*$/, '')
      const envMeta = THEOREM_ENV_META[rawEnv]

      if (envMeta) {
        let cursor = matchStart + match[0].length

        // Verificar título opcional: \begin{teorema}[Título] ou {Título}
        let optionalTitle = ''
        while (cursor < content.length && /\s/.test(content[cursor])) {
          cursor++
        }

        if (content[cursor] === '[') {
          const opt = extractDelimited(content, cursor, '[', ']')
          if (opt) {
            optionalTitle = cleanLatexBody(opt.content, labelMap).trim()
            cursor = opt.endIndex
          }
        } else if (content[cursor] === '{') {
          const opt = extractDelimited(content, cursor, '{', '}')
          if (opt) {
            optionalTitle = cleanLatexBody(opt.content, labelMap).trim()
            cursor = opt.endIndex
          }
        }

        // Encontrar \end{envName} (com ou sem *)
        const endRegex = new RegExp(`\\\\end\\{${rawEnv}\\*?\\}`, 'i')
        const endMatch = endRegex.exec(content.substring(cursor))

        if (endMatch) {
          const endIdx = cursor + endMatch.index
          const bodyText = content.substring(cursor, endIdx)
          const cleanedBody = cleanLatexBody(bodyText, labelMap)

          const finalTitle = optionalTitle || envMeta.defaultTitle
          const id = generateTexNodeId(envMeta.tag)
          const parentId =
            currentSubsubsectionId ||
            currentSubsectionId ||
            currentSectionId ||
            currentChapterId ||
            getOrCreateFallbackRoot()

          nodes.push({
            id,
            parentId,
            position: { x: 0, y: 0 },
            data: {
              title: finalTitle,
              description: cleanedBody,
              tags: [envMeta.tag],
              color: envMeta.color,
              collapsed: false,
              pdfAttachment: null,
            },
          })

          lastIndex = endIdx + endMatch[0].length
          tokenRegex.lastIndex = lastIndex
          continue
        }
      }
    }

    lastIndex = matchStart + match[0].length
  }

  // Texto restante no final do documento
  if (pendingContainerId && lastIndex < content.length) {
    const trailingText = cleanLatexBody(content.substring(lastIndex), labelMap)
    if (trailingText) {
      const targetNode = nodes.find((n) => n.id === pendingContainerId)
      if (targetNode) {
        targetNode.data.description = targetNode.data.description
          ? `${targetNode.data.description}\n\n${trailingText}`
          : trailingText
      }
    }
  }

  // Se nenhum nó foi gerado (ex: texto corrido sem seções), cria nó raiz com o conteúdo
  if (nodes.length === 0) {
    const cleanedAll = cleanLatexBody(content)
    if (cleanedAll) {
      nodes.push({
        id: generateTexNodeId('doc'),
        parentId: null,
        position: { x: 100, y: 100 },
        data: {
          title: docTitle || 'Documento TeX',
          description: cleanedAll,
          tags: ['latex'],
          color: '#6366f1',
          collapsed: false,
          pdfAttachment: null,
        },
      })
    }
  }

  // Aplica layout Dagre para distribuir todos os nós raiz e sub-objetos
  const arrangedNodes = applyDagreLayout(nodes, edges)

  return {
    nodes: arrangedNodes,
    edges,
  }
}

/**
 * Converte documento .tex para formato de Grafo do Epistemap
 */
export function parseLatexToGraph(rawTex: string): Graph {
  return parseTexDocument(rawTex)
}
