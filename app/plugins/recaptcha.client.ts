// Carrega o script do reCAPTCHA v3 uma vez, no client (espelha o initRecaptcha
// do api4com-portal).
export default defineNuxtPlugin(() => {
  const siteKey = useRuntimeConfig().public.recaptchaSiteKey as string
  if (!siteKey || document.getElementById('recaptcha-v3')) return

  const script = document.createElement('script')
  script.id = 'recaptcha-v3'
  script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
  script.async = true
  document.head.appendChild(script)
})
