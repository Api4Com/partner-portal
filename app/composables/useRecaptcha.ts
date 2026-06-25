// reCAPTCHA v3 (espelha o api4com-portal): executa a action e devolve o token.
// Se a chave/script não estiverem disponíveis, resolve null (o backend em
// `observe` não bloqueia; em `enforce` o token é exigido).
export function useRecaptcha() {
  const siteKey = useRuntimeConfig().public.recaptchaSiteKey as string

  function executeRecaptcha(action: string): Promise<string | null> {
    const grecaptcha = (globalThis as unknown as { grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (key: string, opts: { action: string }) => Promise<string>
    } }).grecaptcha

    if (!siteKey || !grecaptcha) return Promise.resolve(null)

    return new Promise((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(siteKey, { action })
          .then(resolve)
          .catch(() => resolve(null))
      })
    })
  }

  return { executeRecaptcha }
}
