// Rota Nitro (server-side), fora do Vue Router: não passa pelo `auth.global.ts`,
// então responde 200 sem sessão. É o alvo do HEALTHCHECK do container e do
// healthcheck do load balancer do Traefik — `/` não serve, porque redireciona
// para /login quando não há token.
export default defineEventHandler(() => ({
  status: 'ok',
  uptime: process.uptime()
}))
