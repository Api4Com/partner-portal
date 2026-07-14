# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-07-11

Primeira versão do produto **partner-portal** (UI Nuxt 4 do portal do parceiro).

O parceiro acessa este portal para enxergar a hierarquia abaixo dele — suas
subcontas e os usuários de cada uma — incluindo chamadas, relatórios e KPIs.
O backend-alvo é o `partner-portal-bff`.

### Adicionado
- Portal do parceiro (Nuxt 4, SSR): páginas de login, painel, subcontas
  (`clientes/[id]`), relatórios, roadmap e agente.
- Tela de Relatórios: filtros (subcontas, período, busca, sort, paginação) e
  5 KPIs (Subcontas, Usuários, Ativos 7d, Volume, Taxa de atendimento).
- Autenticação via JWT do Core (login/refresh/logout), com `useAuth` falando
  com o `partner-portal-bff`.
- Health check público `GET /health`.
- Deploy em staging (docker-compose no host, imagem `partner-portal:staging`
  no ECR us-east-1).
- Pipelines de imagem: **staging** (manual via `workflow_dispatch`) e
  **production** (na publicação de GitHub Release). Cada build publica a tag de
  ambiente + uma tag imutável (`git-<sha>` em staging, `v<version>` em produção)
  para rollback e para a lifecycle policy do ECR.
- Lint (ESLint) + typecheck (vue-tsc) como gate obrigatório: reprovam a criação
  da imagem em erro.

### Infra
- Atualização das referências do backend de `bff-portal` para
  `partner-portal-bff` (fallout do rename do repo/ECR do BFF).
- Guardrail de não-deleção das imagens no ECR (repository policy).
- Lifecycle policy do ECR: mantém as últimas 50 releases (`v*`) e 30 imagens de
  rollback (`git-*`); expira imagens órfãs após 15 dias.
