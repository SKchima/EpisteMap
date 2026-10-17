import katex from 'katex'
import type { ZoomLodLevel } from './types'

export const LOD_THRESHOLDS = {
  MACRO_MAX: 0.65,
  MICRO_MIN: 1.30,
} as const

/**
 * Determina o nível de detalhe semântico (LoD) baseado na escala atual de zoom da câmera.
 * Invariante: zoom < 0.65 -> macro, 0.65 <= zoom < 1.30 -> standard, zoom >= 1.30 -> micro.
 */
export function getZoomLodLevel(zoom: number): ZoomLodLevel {
  if (typeof zoom !== 'number' || isNaN(zoom) || zoom < LOD_THRESHOLDS.MACRO_MAX) {
    return 'macro'
  }
  if (zoom >= LOD_THRESHOLDS.MICRO_MIN) {
    return 'micro'
  }
  return 'standard'
}

const mathCache = new Map<string, string>()

/**
 * Sanitiza e renderiza fórmulas matemáticas KaTeX e referências WikiLink
 * diretamente para HTML seguro para exibição no modo micro.
 */
export function renderMathText(text: string): string {
  if (!text || typeof text !== 'string') return ''

  const cached = mathCache.get(text)
  if (cached !== undefined) return cached

  // Regex para capturar $$display$$ e $inline$
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g
  const parts = text.split(regex)

  const rendered = parts
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim()
        try {
          return `<div class="epistemap-block-math">${katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          })}</div>`
        } catch {
          return part
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim()
        try {
          return `<span class="epistemap-inline-math">${katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          })}</span>`
        } catch {
          return part
        }
      } else {
        // Sanitização básica contra injeção de tags HTML maliciosas
        const escaped = part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        // Formatação de [[WikiLinks]] inline
        return escaped.replace(
          /\[\[(.*?)\]\]/g,
          '<span class="epistemap-lod-wikilink" style="color: inherit; font-weight: 500; text-decoration: underline dotted;">↗ $1</span>'
        )
      }
    })
    .join('')

  if (mathCache.size > 200) {
    mathCache.clear()
  }
  mathCache.set(text, rendered)
  return rendered
}
