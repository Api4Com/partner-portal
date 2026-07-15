// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Base do BFF para chamadas do SERVIDOR (SSR). Só existe no server.
    // Em docker, o browser alcança o BFF por `localhost:3005` (porta publicada no
    // host), mas o container NÃO: lá dentro `localhost` é o próprio Nuxt e a porta
    // 3005 recusa conexão. O SSR precisa do hostname da rede interna
    // (`http://partner-portal-bff:3000`). Sem isto, todo render no servidor falha e
    // derruba a sessão. Vazio => cai no `public.bffBase` (dev fora de docker, onde
    // as duas URLs coincidem).
    bffInternalBase: process.env.BFF_INTERNAL_URL || '',

    public: {
      // bffBase: única origem do portal — login/logout, /users/me e dados
      // (subaccounts/calls/reports). O portal não fala direto com o Core.
      // Esta é a URL vista pelo NAVEGADOR.
      bffBase: process.env.BFF_BASE || process.env.NUXT_PUBLIC_BFF_BASE_URL || 'http://localhost:3005',
      // reCAPTCHA v3 (action "signup") — o signup do pbx valida. Chave de dev por padrão.
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',

      // Supabase: fonte de dados APENAS do roadmap/admin (itens, reações, comentários,
      // Storage). NÃO é autenticação — quem loga é o pbx (`middleware/auth.global.ts`).
      // Ausente => `useSupabaseClient()` devolve null e o roadmap degrada para vazio,
      // sem derrubar o resto do portal. Sobrescrevível em runtime por NUXT_PUBLIC_*.
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_KEY || ''
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
