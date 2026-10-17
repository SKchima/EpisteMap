import { describe, it, expect } from 'vitest'
import {
  stripLatexComments,
  extractDelimited,
  cleanLatexBody,
  extractDocumentTitle,
  parseTexDocument,
  parseLatexToGraph,
  THEOREM_ENV_META,
} from '../texImporter'

describe('texImporter', () => {
  describe('stripLatexComments', () => {
    it('remove comentários simples com %', () => {
      const tex = 'Texto normal % comentário aqui\nSegunda linha'
      expect(stripLatexComments(tex)).toBe('Texto normal \nSegunda linha')
    })

    it('preserva porcentagem escapada \\%', () => {
      const tex = 'Rendimento de 15\\% ao ano % comentário no final'
      expect(stripLatexComments(tex)).toBe('Rendimento de 15\\% ao ano ')
    })

    it('remove linhas que contêm apenas comentários', () => {
      const tex = '% linha comentada\nConteúdo útil\n% outro comentário'
      expect(stripLatexComments(tex)).toBe('\nConteúdo útil\n')
    })
  })

  describe('extractDelimited', () => {
    it('extrai conteúdo entre delimitadores simples', () => {
      const text = 'prefixo {meu conteudo} sufixo'
      const res = extractDelimited(text, 8, '{', '}')
      expect(res).not.toBeNull()
      expect(res?.content).toBe('meu conteudo')
      expect(res?.endIndex).toBe(22)
    })

    it('suporta delimitadores aninhados', () => {
      const text = '\\section{Teoria dos {Grupos} Finitos}'
      const res = extractDelimited(text, 8, '{', '}')
      expect(res).not.toBeNull()
      expect(res?.content).toBe('Teoria dos {Grupos} Finitos')
      expect(res?.endIndex).toBe(37)
    })

    it('ignora chaves escapadas \\{ e \\}', () => {
      const text = '{\\{elemento\\}}'
      const res = extractDelimited(text, 0, '{', '}')
      expect(res).not.toBeNull()
      expect(res?.content).toBe('\\{elemento\\}')
    })

    it('retorna null se o caractere inicial não corresponder', () => {
      const text = 'sem delimitador'
      expect(extractDelimited(text, 0, '{', '}')).toBeNull()
    })

    it('retorna null se o delimitador não for fechado', () => {
      const text = '{aberto sem fechar'
      expect(extractDelimited(text, 0, '{', '}')).toBeNull()
    })
  })

  describe('cleanLatexBody', () => {
    it('converte ambiente equation em bloco KaTeX $$', () => {
      const tex = '\\begin{equation}\n  E = mc^2\n\\end{equation}'
      const out = cleanLatexBody(tex)
      expect(out).toContain('$$\nE = mc^2\n$$')
    })

    it('converte ambiente align e align* em aligned dentro de $$', () => {
      const tex = '\\begin{align*}\n  a &= b + c \\\\\n  d &= e\n\\end{align*}'
      const out = cleanLatexBody(tex)
      expect(out).toContain('$$\n\\begin{aligned}\na &= b + c \\\\\n  d &= e\n\\end{aligned}\n$$')
    })

    it('converte ambiente gather em gathered dentro de $$', () => {
      const tex = '\\begin{gather}\n  x + y = 10\n\\end{gather}'
      const out = cleanLatexBody(tex)
      expect(out).toContain('$$\n\\begin{gathered}\nx + y = 10\n\\end{gathered}\n$$')
    })

    it('converte \\ref{...} em wiki-link [[...]]', () => {
      const tex = 'Conforme demonstrado no Teorema \\ref{thm:pitagoras}.'
      expect(cleanLatexBody(tex)).toBe('Conforme demonstrado no Teorema [[thm:pitagoras]].')
    })

    it('converte formatações de texto básicas (textbf, textit, emph, underline)', () => {
      const tex = '\\textbf{Negrito} e \\textit{itálico} com \\emph{ênfase} e \\underline{sublinhado}.'
      expect(cleanLatexBody(tex)).toBe('**Negrito** e *itálico* com *ênfase* e _sublinhado_.')
    })

    it('converte listas itemize/enumerate para Markdown', () => {
      const tex = '\\begin{itemize}\n\\item Primeiro item\n\\item Segundo item\n\\end{itemize}'
      const out = cleanLatexBody(tex)
      expect(out).toContain('- Primeiro item')
      expect(out).toContain('- Segundo item')
      expect(out).not.toContain('\\begin{itemize}')
      expect(out).not.toContain('\\end{itemize}')
    })

    it('remove comandos utilitários como \\label, \\par, \\noindent, \\vspace', () => {
      const tex = '\\label{eq:1}\\noindent Texto aqui.\\par\\vspace{10pt}Outro texto.'
      const out = cleanLatexBody(tex)
      expect(out).not.toContain('\\label{eq:1}')
      expect(out).not.toContain('\\noindent')
      expect(out).not.toContain('\\vspace{10pt}')
      expect(out).toContain('Texto aqui.')
      expect(out).toContain('Outro texto.')
    })

    it('converte display math unnumbered \\[...\\] em bloco KaTeX $$', () => {
      const tex = '\\[\n  \\int_0^1 x^2 dx = \\frac{1}{3}\n\\]'
      const out = cleanLatexBody(tex)
      expect(out).toContain('$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$')
    })

    it('converte inline math \\(...\\) em formato KaTeX $...$', () => {
      const tex = 'Seja \\(x \\in \\mathbb{R}\\) um valor real.'
      const out = cleanLatexBody(tex)
      expect(out).toBe('Seja $x \\in \\mathbb{R}$ um valor real.')
    })

    it('converte \\eqref{...} em wiki-link [[...]] e resolve via labelMap', () => {
      const tex = 'Pela equação \\eqref{eq:euler} e teorema \\ref{thm:pitagoras}.'
      const labelMap = { 'thm:pitagoras': 'Teorema de Pitágoras' }
      const out = cleanLatexBody(tex, labelMap)
      expect(out).toBe('Pela equação [[eq:euler]] e teorema [[Teorema de Pitágoras]].')
    })

    it('converte links \\url e \\href para Markdown', () => {
      const tex = 'Visite \\url{https://epistemap.org} ou \\href{https://usp.br}{USP}.'
      const out = cleanLatexBody(tex)
      expect(out).toBe('Visite [https://epistemap.org](https://epistemap.org) ou [USP](https://usp.br).')
    })

    it('converte código \\texttt e aspas tipográficas LaTeX', () => {
      const tex = 'O comando \\texttt{git status} entre ``aspas duplas\'\' e `simples\'.'
      const out = cleanLatexBody(tex)
      expect(out).toBe('O comando `git status` entre "aspas duplas" e \'simples\'.')
    })

    it('converte travessões --- e --', () => {
      const tex = 'Conceito principal---definição formal--intervalo 1--10.'
      const out = cleanLatexBody(tex)
      expect(out).toBe('Conceito principal—definição formal–intervalo 1–10.')
    })

    it('converte listas com marcadores customizados \\item[a)]', () => {
      const tex = '\\begin{enumerate}\n\\item[(i)] Propriedade 1\n\\item[b)] Propriedade 2\n\\end{enumerate}'
      const out = cleanLatexBody(tex)
      expect(out).toContain('- (i) Propriedade 1')
      expect(out).toContain('- b) Propriedade 2')
    })

    it('converte símbolos de prova \\qed, \\blacksquare para ■', () => {
      const tex = 'Demonstração concluída. \\qed'
      const out = cleanLatexBody(tex)
      expect(out).toBe('Demonstração concluída. ■')
    })
  })

  describe('extractDocumentTitle', () => {
    it('extrai título de \\title{...}', () => {
      const tex = '\\documentclass{article}\n\\title{Compêndio de Análise Real}\n\\begin{document}'
      expect(extractDocumentTitle(tex)).toBe('Compêndio de Análise Real')
    })

    it('extrai título contendo chaves aninhadas e formatação', () => {
      const tex = '\\documentclass{article}\n\\title{Teoria dos {Grupos} e \\textbf{Álgebras}}\n\\begin{document}'
      expect(extractDocumentTitle(tex)).toBe('Teoria dos {Grupos} e **Álgebras**')
    })

    it('retorna null se não houver \\title', () => {
      const tex = '\\begin{document}\nOlá mundo\n\\end{document}'
      expect(extractDocumentTitle(tex)).toBeNull()
    })
  })

  describe('parseTexDocument', () => {
    it('constrói hierarquia com sections, subsections e ambientes de teoremas', () => {
      const tex = `
\\documentclass{book}
\\title{Geometria Diferencial}
\\begin{document}
\\section{Curvas no Espaço}
Texto introdutório sobre curvas.

\\subsection{Parametrização por Comprimento de Arco}
\\begin{definicao}[Comprimento de Arco]
Dada uma curva $\\alpha(t)$, seu comprimento de arco é definido por:
\\begin{equation}
s(t) = \\int_{t_0}^t |\\alpha'(u)| du
\\end{equation}
\\end{definicao}

\\begin{teorema}[Teorema Fundamental das Curvas]
Uma curva regular é unicamente determinada por sua curvatura e torção.
Veja \\ref{def:curvatura}.
\\end{teorema}

\\end{document}
`
      const { nodes, edges } = parseTexDocument(tex)

      expect(nodes.length).toBe(4) // 1 section, 1 subsection, 1 definicao, 1 teorema
      expect(edges.length).toBe(0)

      // Section
      const secNode = nodes.find((n) => n.data.title === 'Curvas no Espaço')
      expect(secNode).toBeDefined()
      expect(secNode?.parentId).toBeNull()
      expect(secNode?.data.tags).toContain('secao')
      expect(secNode?.data.description).toContain('Texto introdutório sobre curvas.')

      // Subsection
      const subNode = nodes.find((n) => n.data.title === 'Parametrização por Comprimento de Arco')
      expect(subNode).toBeDefined()
      expect(subNode?.parentId).toBe(secNode?.id)
      expect(subNode?.data.tags).toContain('subsecao')

      // Definicao
      const defNode = nodes.find((n) => n.data.title === 'Comprimento de Arco')
      expect(defNode).toBeDefined()
      expect(defNode?.parentId).toBe(subNode?.id)
      expect(defNode?.data.tags).toContain('definicao')
      expect(defNode?.data.color).toBe(THEOREM_ENV_META.definicao.color)
      expect(defNode?.data.description).toContain('$$\ns(t) = \\int_{t_0}^t |\\alpha\'(u)| du\n$$')

      // Teorema
      const thmNode = nodes.find((n) => n.data.title === 'Teorema Fundamental das Curvas')
      expect(thmNode).toBeDefined()
      expect(thmNode?.parentId).toBe(subNode?.id)
      expect(thmNode?.data.tags).toContain('teorema')
      expect(thmNode?.data.color).toBe(THEOREM_ENV_META.teorema.color)
      expect(thmNode?.data.description).toContain('Veja [[def:curvatura]].')

      // Dagre layout deve atribuir coordenadas não nulas aos nós raiz
      expect(secNode?.position.x).toBeTypeOf('number')
      expect(secNode?.position.y).toBeTypeOf('number')
    })

    it('suporta compêndios com lema, corolário, proposição, exemplo e exercício', () => {
      const tex = `
\\section{Álgebra Abstrata}
\\begin{lema}[Lema de Zorn]
Todo conjunto parcialmente ordenado não vazio possui elemento maximal.
\\end{lema}

\\begin{proposicao}
Toda álgebra finitamente gerada é noetheriana.
\\end{proposicao}

\\begin{corolario}
Segue diretamente da proposição anterior.
\\end{corolario}

\\begin{exemplo}[Espaço Euclidiano]
O espaço $\\mathbb{R}^n$ é um espaço vetorial de dimensão $n$.
\\end{exemplo}

\\begin{exercicio}
Mostre que a soma direta de corpos não é necessariamente um corpo.
\\end{exercicio}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(6)

      const lema = nodes.find((n) => n.data.tags.includes('lema'))
      expect(lema?.data.title).toBe('Lema de Zorn')
      expect(lema?.data.color).toBe(THEOREM_ENV_META.lema.color)

      const prop = nodes.find((n) => n.data.tags.includes('proposicao'))
      expect(prop?.data.title).toBe('Proposição')

      const corolario = nodes.find((n) => n.data.tags.includes('corolario'))
      expect(corolario?.data.title).toBe('Corolário')

      const exemplo = nodes.find((n) => n.data.tags.includes('exemplo'))
      expect(exemplo?.data.title).toBe('Espaço Euclidiano')

      const exercicio = nodes.find((n) => n.data.tags.includes('exercicio'))
      expect(exercicio?.data.title).toBe('Exercício')
    })

    it('suporta ambientes com acentos gráficos em português (definição, corolário)', () => {
      const tex = `
\\section{Terminologia}
\\begin{definição}[Espaço Conexo]
Um espaço topológico que não pode ser particionado.
\\end{definição}
\\begin{corolário}
Qualquer intervalo da reta é conexo.
\\end{corolário}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(3)
      expect(nodes.some((n) => n.data.title === 'Espaço Conexo')).toBe(true)
      expect(nodes.some((n) => n.data.title === 'Corolário')).toBe(true)
    })

    it('cria nó raiz para texto puro sem seções nem ambientes de teoremas', () => {
      const tex = `
\\title{Notas Rápidas}
\\begin{document}
Estas são notas breves sobre o Teorema Central do Limite com KaTeX $X \\sim \\mathcal{N}(0, 1)$.
\\end{document}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(1)
      expect(nodes[0].data.title).toBe('Notas Rápidas')
      expect(nodes[0].parentId).toBeNull()
      expect(nodes[0].data.description).toContain('Teorema Central do Limite')
    })

    it('retorna grafo vazio para arquivo LaTeX sem conteúdo ou apenas comentários', () => {
      const tex = '% Apenas comentários\n% Segunda linha\n   \n'
      const { nodes, edges } = parseTexDocument(tex)
      expect(nodes.length).toBe(0)
      expect(edges.length).toBe(0)
    })

    it('parseLatexToGraph é alias funcional de parseTexDocument', () => {
      const tex = '\\section{Teste}\\begin{teorema}Corpo\\end{teorema}'
      const graph = parseLatexToGraph(tex)
      expect(graph.nodes.length).toBe(2)
      expect(graph.edges).toEqual([])
    })

    it('preserva equações (equation e align) diretamente dentro de seções sem corromper delimitadores', () => {
      const tex = `
\\section{Física Matemática}
A famosa relação de equivalência massa-energia:
\\begin{equation}
E = mc^2
\\end{equation}
E o sistema de equações de Maxwell:
\\begin{align}
\\nabla \\cdot E &= \\frac{\\rho}{\\varepsilon_0} \\\\
\\nabla \\times B &= \\mu_0 J
\\end{align}
Conclusão da seção.
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(1)
      const sec = nodes[0]
      expect(sec.data.title).toBe('Física Matemática')
      expect(sec.data.description).toContain('$$\nE = mc^2\n$$')
      expect(sec.data.description).toContain('$$\n\\begin{aligned}\n\\nabla \\cdot E &= \\frac{\\rho}{\\varepsilon_0} \\\\\n\\nabla \\times B &= \\mu_0 J\n\\end{aligned}\n$$')
      expect(sec.data.description).toContain('Conclusão da seção.')
      expect(sec.data.description).not.toContain('\\begin{equation}')
      expect(sec.data.description).not.toContain('\\end{equation}')
    })

    it('suporta seções e subseções com argumentos opcionais [Short Title]', () => {
      const tex = `
\\section[Intro Curta]{Introdução Abrangente}
Texto introdutório.
\\subsection[Topologia Breve]{Topologia dos Espaços Métricos}
Texto da subseção.
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(2)
      expect(nodes[0].data.title).toBe('Introdução Abrangente')
      expect(nodes[0].parentId).toBeNull()
      expect(nodes[1].data.title).toBe('Topologia dos Espaços Métricos')
      expect(nodes[1].parentId).toBe(nodes[0].id)
    })

    it('suporta ambientes com asterisco (teorema*, definicao* unnumbered)', () => {
      const tex = `
\\section{Aritmética}
\\begin{teorema*}[Infinitude dos Primos]
Existem infinitos números primos.
\\end{teorema*}
\\begin{definicao*}
Um número primo é divisível apenas por 1 e por si mesmo.
\\end{definicao*}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(3)
      const thm = nodes.find((n) => n.data.title === 'Infinitude dos Primos')
      expect(thm).toBeDefined()
      expect(thm?.data.tags).toContain('teorema')
      expect(thm?.data.description).toContain('Existem infinitos números primos.')

      const def = nodes.find((n) => n.data.tags.includes('definicao'))
      expect(def).toBeDefined()
      expect(def?.data.title).toBe('Definição')
      expect(def?.data.description).toContain('divisível apenas por 1 e por si mesmo.')
    })

    it('suporta hierarquia completa com capítulo, seção, subseção e subsubseção', () => {
      const tex = `
\\chapter{Cálculo Avançado}
\\section{Cálculo Vetorial}
\\subsection{Teoremas de Integração}
\\subsubsection{Superfícies Orientáveis}
\\begin{teorema}[Teorema de Stokes]
A integral de linha ao longo da fronteira é igual ao fluxo do rotacional.
\\end{teorema}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(5)

      const chap = nodes.find((n) => n.data.tags.includes('capitulo'))
      expect(chap).toBeDefined()
      expect(chap?.parentId).toBeNull()

      const sec = nodes.find((n) => n.data.tags.includes('secao'))
      expect(sec?.parentId).toBe(chap?.id)

      const sub = nodes.find((n) => n.data.title === 'Teoremas de Integração')
      expect(sub?.parentId).toBe(sec?.id)

      const subsub = nodes.find((n) => n.data.title === 'Superfícies Orientáveis')
      expect(subsub?.parentId).toBe(sub?.id)

      const thm = nodes.find((n) => n.data.title === 'Teorema de Stokes')
      expect(thm?.parentId).toBe(subsub?.id)
    })

    it('suporta ambientes de demonstração (proof e demonstracao) e notas/observações', () => {
      const tex = `
\\section{Geometria}
\\begin{teorema}[Teorema de Pitágoras]
$a^2 + b^2 = c^2$.
\\end{teorema}
\\begin{proof}
Considere a decomposição de áreas do quadrado. \\qed
\\end{proof}
\\begin{observacao}[Aplicação]
Útil em espaços com produto interno.
\\end{observacao}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(4)

      const proof = nodes.find((n) => n.data.tags.includes('demonstracao'))
      expect(proof).toBeDefined()
      expect(proof?.data.title).toBe('Demonstração')
      expect(proof?.data.description).toContain('■')

      const obs = nodes.find((n) => n.data.tags.includes('observacao'))
      expect(obs).toBeDefined()
      expect(obs?.data.title).toBe('Aplicação')
      expect(obs?.data.description).toContain('espaços com produto interno')
    })

    it('resolve referências cruzadas \\ref{...} para títulos dos nós via pré-escaneamento de \\label', () => {
      const tex = `
\\section{Análise}
\\begin{teorema}[Teorema da Convergência Dominada]
\\label{thm:tcd}
Se $|f_n| \\le g$ com $g$ integrável, então o limite comuta com a integral.
\\end{teorema}

\\begin{corolario}[Convergência em Medida]
Pelo Teorema \\ref{thm:tcd}, segue o resultado para sequências quase-uniformes.
\\end{corolario}
`
      const { nodes } = parseTexDocument(tex)
      expect(nodes.length).toBe(3)

      const cor = nodes.find((n) => n.data.tags.includes('corolario'))
      expect(cor).toBeDefined()
      expect(cor?.data.description).toContain('[[Teorema da Convergência Dominada]]')
    })
  })
})
