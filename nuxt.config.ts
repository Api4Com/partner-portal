// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // bffBase: login/signup + dados (subaccounts/calls/reports). coreBase: refresh.
      bffBase: process.env.BFF_BASE || process.env.NUXT_PUBLIC_BFF_BASE_URL || 'http://localhost:3005',
      coreBase: process.env.CORE_BASE || process.env.NUXT_PUBLIC_CORE_BASE_URL || 'http://localhost:3001',
      // reCAPTCHA v3 (action "signup") — o signup do pbx valida. Chave de dev por padrão.
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
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
