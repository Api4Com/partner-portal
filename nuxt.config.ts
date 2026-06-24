// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // Base do bff-portal (proxy fino). Todo tráfego do portal passa pelo BFF,
      // que repassa ao pbxapi. O portal NUNCA fala direto com o pbxapi.
      // URL em env porque difere em prod.
      bffBase: process.env.BFF_BASE || 'http://localhost:7002'
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
