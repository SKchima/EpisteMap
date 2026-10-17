import { describe, it, expect } from 'vitest'
import { getZoomLodLevel, renderMathText, LOD_THRESHOLDS } from '../lod'

describe('Zoom Level of Detail (LoD) Engine', () => {
  describe('getZoomLodLevel', () => {
    it('deve classificar zoom < 0.65 como macro', () => {
      expect(getZoomLodLevel(0.1)).toBe('macro')
      expect(getZoomLodLevel(0.3)).toBe('macro')
      expect(getZoomLodLevel(0.649)).toBe('macro')
    })

    it('deve classificar 0.65 <= zoom < 1.30 como standard', () => {
      expect(getZoomLodLevel(0.65)).toBe('standard')
      expect(getZoomLodLevel(1.0)).toBe('standard')
      expect(getZoomLodLevel(1.299)).toBe('standard')
    })

    it('deve classificar zoom >= 1.30 como micro', () => {
      expect(getZoomLodLevel(1.30)).toBe('micro')
      expect(getZoomLodLevel(2.0)).toBe('micro')
      expect(getZoomLodLevel(4.0)).toBe('micro')
    })

    it('deve lidar com casos de borda e valores anômalos com fallback seguro para macro', () => {
      expect(getZoomLodLevel(NaN)).toBe('macro')
      expect(getZoomLodLevel(-1)).toBe('macro')
      // @ts-expect-error testando entrada não numérica
      expect(getZoomLodLevel(null)).toBe('macro')
    })

    it('deve expor constantes estritas de limiares', () => {
      expect(LOD_THRESHOLDS.MACRO_MAX).toBe(0.65)
      expect(LOD_THRESHOLDS.MICRO_MIN).toBe(1.30)
    })
  })

  describe('renderMathText', () => {
    it('deve retornar string vazia para entradas nulas ou vazias', () => {
      expect(renderMathText('')).toBe('')
      // @ts-expect-error testando entrada inválida
      expect(renderMathText(null)).toBe('')
    })

    it('deve preservar texto puro escapando tags HTML para evitar injeção', () => {
      const res = renderMathText('Texto simples com <b>negrito</b> e & comercial')
      expect(res).toContain('&lt;b&gt;negrito&lt;/b&gt;')
      expect(res).toContain('&amp; comercial')
      expect(res).not.toContain('<b>')
    })

    it('deve renderizar equações matemáticas inline via KaTeX', () => {
      const res = renderMathText('A equação $x^2 + y^2 = 1$ representa uma circunferência.')
      expect(res).toContain('class="epistemap-inline-math"')
      expect(res).toContain('class="katex"')
      expect(res).toContain('x^2 + y^2 = 1')
    })

    it('deve renderizar equações matemáticas em bloco via KaTeX', () => {
      const res = renderMathText('Integral Gaussiana:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$')
      expect(res).toContain('class="epistemap-block-math"')
      expect(res).toContain('class="katex"')
      expect(res).toContain('\\int_{-\\infty}')
    })

    it('deve formatar referências WikiLinks inline [[Conceito]]', () => {
      const res = renderMathText('Veja também [[Espaço Métrico]] para mais detalhes.')
      expect(res).toContain('class="epistemap-lod-wikilink"')
      expect(res).toContain('↗ Espaço Métrico')
    })

    it('deve lidar com fórmulas LaTeX inválidas sem quebrar ou disparar exceção', () => {
      expect(() => {
        const res = renderMathText('Fórmula com erro $\\frac{sem_fechar$')
        expect(typeof res).toBe('string')
      }).not.toThrow()
    })
  })
})
