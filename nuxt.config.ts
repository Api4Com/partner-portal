// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // bffBase: login/signup. coreBase: refresh + dados pós-login (TEL-1979).
      bffBase: process.env.BFF_BASE || 'http://localhost:7002',
      coreBase: process.env.CORE_BASE || 'http://localhost:3003'
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
