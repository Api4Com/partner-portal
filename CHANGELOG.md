# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-07-15

Refinamentos de UX sobre a 1.0.0: tema claro/escuro manual, ajustes no roadmap do
parceiro e melhorias de datas/formatação nos relatórios e no cadastro de subconta.
Sem mudanças incompatíveis.

### Adicionado

**Tema (claro/escuro)**
- Toggle manual de tema (`PortalThemeToggle`) com persistência da preferência de
  cor entre sessões; acessível pela sidebar.

**Relatórios e detalhe da subconta**
- Utilitário `callTime` para formatar a data/hora das chamadas com ajuste de fuso.
- Tratamento de intervalo de datas personalizado mais robusto nos relatórios e no
  filtro do detalhe da subconta, com mensagens de estado vazio mais claras.

**Cadastro de subconta**
- Formatação de documento (CPF/CNPJ) no `NovaSubcontaWizard`.

### Alterado

**Roadmap**
- Interações ocultas (voto, comentário e formulário de solicitação) e aba "Técnico"
  removida da visão do parceiro; contato agora é direto (WhatsApp).
- Representação dos itens "No radar" revista e opções de contato direto.
- Suporte a dark mode e consistência visual do roadmap aprimorados.

**Credenciais**
- `NovaCredencialModal` simplificado: removido o seletor de permissões não utilizado.

## [1.0.0] - 2026-07-11

Primeira versão do produto **partner-portal** (UI Nuxt 4 do portal do parceiro) e
**primeiro deploy em produção**.

O parceiro acessa este portal para enxergar a hierarquia abaixo dele — suas
subcontas e os usuários de cada uma — incluindo chamadas, relatórios e KPIs. O
backend-alvo é o `partner-portal-bff` (que compõe core-service + pbxapi).

### Adicionado

**Autenticação e sessão**
- Login pelo BFF (proxy do pbxapi); token de sessão do pbx em cookie `access_token`
  (SSR-safe, `secure` em produção).
- Refresh token **httpOnly via BFF**, fora do alcance do JS (TEL-1979 FRONT-1).
- Middleware global de proteção de rotas (pública: `/login`).
- Tratamento de erro consciente: só 401/403 derrubam a sessão; 403 do PartnerGuard
  (conta não-parceira) desloga, mas 403 de recurso (ex.: PII de usuários ao papel
  PARTNER) é tolerado sem deslogar. Falhas transitórias (rede/5xx) preservam a sessão.
- Tela de login com animação typewriter API4COM; toggle de visibilidade de senha.
  Signup temporariamente desabilitado.

**Painel Geral**
- Consome o BFF (`/subaccounts` + `/reports/summary`): lista de subcontas com status
  real (inferido), 4 KPIs (subcontas, ligando nos últimos 7d, volume do mês, taxa de
  atendimento), barra de volumetria por status e paginação.
- Wizard de nova subconta que cria de verdade (`POST /subaccounts`) com reCAPTCHA.

**Detalhe da subconta**
- Usuários da subconta via BFF (`/subaccounts/:id/users`) e volumetria via
  `/reports/summary` escopado; filtros estilo Pipedrive (busca, acesso, status,
  data com intervalo personalizado) e breadcrumb.

**Relatórios**
- Consome o BFF (`/subaccounts`, `/calls`, `/reports/summary`): filtros (subcontas
  multi, período incl. personalizado, busca sem acento, sort, paginação), 5 KPIs,
  URL de gravação por chamada e export CSV. Descarte de respostas obsoletas por
  sequência (filtros mudam rápido).

**Credenciais**
- Gestão de credenciais/API keys do parceiro: listagem, criação (modal) e ações.

**Roadmap**
- Roadmap do parceiro: solicitação de demandas com gestão no admin, upload de
  arquivos, reações (like/dislike) e comentários.
- Agente `/roadmap-jira`: lê tickets do Jira e propõe cards de "Em desenvolvimento
  agora" para aprovação antes de publicar.

**Navegação / UI**
- Sidebar com launcher de produtos do workspace e dados dinâmicos do usuário
  (iniciais, empresa, papel admin); menu lateral recolhível; ícone próprio do portal.
- Health check público `GET /health`.

### Infra / CI-CD
- Containerização (Dockerfile multi-stage, produção em Nitro standalone) com
  healthcheck; rede `platform_shared`. Ajustes de `docker-compose` para uso no Platform.
- Pipeline de imagem no ECR (us-east-1): **staging** manual (`workflow_dispatch`) e
  **produção** na publicação de GitHub Release. Cada build publica a tag de ambiente
  + uma tag imutável (`git-<sha>` em staging, `v<version>` em produção).
- Lint (ESLint) + typecheck (vue-tsc) como **gate obrigatório** do CI (Node 24).
- Deploy no host **manual**, documentado no runbook compartilhado
  `deploy/runbooks/deploy-partners.md` (portal + BFF).
- ECR endurecido: guardrail de não-deleção (repository policy) + lifecycle policy
  (mantém 50 `v*` / 30 `git-*`; expira órfãs em 15 dias).

### Notas
- Referências do backend padronizadas de `bff-portal` para `partner-portal-bff`
  (fallout do rename do repo/ECR do BFF).
- Ainda **não** expostos pelo BFF (ficam atrás de flag, ocultos): escrita de usuários
  da subconta e os cards de API key/observabilidade no detalhe da subconta.
