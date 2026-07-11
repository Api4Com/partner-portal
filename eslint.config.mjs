// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Vue 3 permite múltiplos elementos root (fragments). Várias páginas usam
      // isso de propósito (ex.: <PortalTopbar> + conteúdo como irmãos), então a
      // regra herdada — de origem Vue 2 — é falso-positivo aqui.
      'vue/no-multiple-template-root': 'off'
    }
  }
)
