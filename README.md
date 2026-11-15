# Pauta de marketing Bora: API

API da pauta de marketing (POC local): pautas, empreendimentos, responsáveis e usuários. Já estão prontos a fundação (configuração, logs, erros, paginação, Swagger, health, persistência com Postgres, relógio de domínio e harness e2e), a autenticação própria (login por e-mail e senha, JWT, refresh com rotação) e a administração de usuários ([`docs/auth.md`](./docs/auth.md)), os cadastros de empreendimentos e responsáveis e a escrita das pautas (criar, editar, trocar status, excluir e detalhar por id), a listagem com filtros, o resumo e o seed de exemplos.

## Stack

NestJS 11 (CommonJS) em Node 26.13.1, TypeScript 5, Express, `@nestjs/config` com validação por classe, `@nestjs/swagger`, `@nestjs/terminus`, `@nestjs/throttler`, Winston (`nest-winston`), `helmet`. Banco: Postgres 18 + TypeORM 0.3 (`@nestjs/typeorm` 11, `pg`); ids uuid v7 (`uuid`). Testes: Vitest + `unplugin-swc`. Lint e formatação: Biome 2.

Arquitetura em camadas (domain / application / infrastructure) com regras de dependência verificadas pelo Biome. Detalhes e convenções em [`CLAUDE.md`](./CLAUDE.md).

## Pré-requisitos

- Node **26.13.1** (`nvm use`, versão em `.nvmrc`)
- Docker (Postgres local e testes e2e via Testcontainers)

## Como subir

```bash
nvm use
npm ci
cp .env.example .env            # opcional: os padrões já servem para `local`
docker compose -f docker/compose.yaml --profile db up -d   # Postgres em localhost:5433
npm run migration:run           # aplica as migrations pendentes
npm run seed:dev                # usuários dev.*@pauta.local + dados de exemplo (só local/demo)
npm run start:dev               # API em http://localhost:3000
```

Para entrar: `POST /api/v1/auth/login` com `dev.admin@pauta.local`, `dev.editor@pauta.local` ou `dev.leitor@pauta.local` e a **senha só de desenvolvimento** `dev-only-pauta-2026` (pública, criada pelo `seed:dev`; nunca use fora de uma máquina de desenvolvimento; `SEED_DEV_PASSWORD` a troca). Sem seed, defina `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` para a API criar o administrador inicial na primeira subida. Passo a passo e exemplos em [`docs/auth.md`](./docs/auth.md).

- `GET http://localhost:3000/health` (fora do prefixo `/api`, sem versão)
- Swagger: `http://localhost:3000/docs`
- Rotas de negócio: `/api/v1/...`

O Postgres do `compose` publica a porta **5433** do host (a 5432 costuma estar ocupada por outro serviço). Banco `pauta`, usuário e senha `pauta`/`pauta`, **só para uso local**.

## Variáveis de ambiente

Validadas na subida (`src/config/env.validation.ts`); a API recusa iniciar com valor inválido.

| Variável                           | Padrão                                       | Descrição                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                         | `development`                                | `development`, `test` ou `production`                                                                                                                                                         |
| `STAGE`                            | `local`                                      | `local`, `e2e` ou `demo` (`demo` = stack completa da demonstração). Em `local` o log é colorido; nos demais, JSON                                                                             |
| `PORT`                             | `3000`                                       | Porta HTTP (1 a 65535)                                                                                                                                                                        |
| `APP_TIMEZONE`                     | `America/Sao_Paulo`                          | Fuso IANA usado para calcular "hoje" (validado com `Intl.supportedValuesOf('timeZone')`, mais `UTC`)                                                                                          |
| `CORS_ORIGINS`                     | `http://localhost:5173`                      | Origens permitidas, separadas por vírgula. O padrão só vale em `local`/`e2e`; **obrigatória** em `demo`                                                                                       |
| `LOG_LEVEL`                        | `info`                                       | `error`, `warn`, `info` ou `debug`                                                                                                                                                            |
| `THROTTLE_LIMIT_PER_MINUTE`        | `300`                                        | Limite de requisições por minuto, por IP                                                                                                                                                      |
| `SWAGGER_ENABLED`                  | `true`                                       | Publica o Swagger em `/docs` (fica ligado também em `demo`)                                                                                                                                   |
| `DATABASE_HOST`                    | `localhost`                                  | Host do Postgres. O padrão só vale em `local`; **obrigatória** nos demais `STAGE`                                                                                                             |
| `DATABASE_PORT`                    | `5433`                                       | Porta do Postgres (1 a 65535). Mesma regra de obrigatoriedade                                                                                                                                 |
| `DATABASE_USER`                    | `pauta`                                      | Usuário do Postgres. Mesma regra de obrigatoriedade                                                                                                                                           |
| `DATABASE_PASS`                    | `pauta`                                      | Senha do Postgres. Mesma regra de obrigatoriedade                                                                                                                                             |
| `DATABASE_NAME`                    | `pauta`                                      | Nome do banco. Mesma regra de obrigatoriedade                                                                                                                                                 |
| `DATABASE_SSL`                     | `false`                                      | `true` liga TLS na conexão (Neon/produção); `false` no Postgres local. Só aceita `true` ou `false`; **obrigatória** fora de `local`                                                           |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true`                                       | Com `DATABASE_SSL=true`, valida o certificado do servidor                                                                                                                                     |
| `DATABASE_POOL_MAX`                | `10`                                         | Máximo de conexões do pool                                                                                                                                                                    |
| `JWT_SECRET`                       | (padrão de desenvolvimento em `local`/`e2e`) | Segredo HMAC dos access tokens (HS256), mínimo de 32 caracteres. **Obrigatório** fora de `local`/`e2e`; o padrão de desenvolvimento é recusado fora deles. Gere com `openssl rand -base64 48` |
| `JWT_ISSUER`                       | `pauta-mkt-api`                              | `iss` fixo do access token                                                                                                                                                                    |
| `JWT_AUDIENCE`                     | `pauta-mkt`                                  | `aud` fixo do access token                                                                                                                                                                    |
| `JWT_ACCESS_TTL`                   | `15m`                                        | Validade do access token (inteiro + `s`, `m`, `h` ou `d`)                                                                                                                                     |
| `JWT_REFRESH_TTL`                  | `7d`                                         | Validade do refresh token (mesmo formato)                                                                                                                                                     |
| `LOGIN_MAX_ATTEMPTS`               | `5`                                          | Falhas de senha seguidas que bloqueiam a conta                                                                                                                                                |
| `LOGIN_LOCK_MINUTES`               | `15`                                         | Minutos de bloqueio da conta                                                                                                                                                                  |
| `LOGIN_THROTTLE_LIMIT_PER_MINUTE`  | `10`                                         | Limite de requisições por minuto, por IP, em `POST /auth/login` e `POST /auth/change-password` (além do `THROTTLE_LIMIT_PER_MINUTE`)                                                          |
| `BOOTSTRAP_ADMIN_EMAIL`            | (sem padrão)                                 | E-mail do administrador inicial. Só tem efeito se **não existir nenhum usuário**; as duas `BOOTSTRAP_*` juntas ou nenhuma                                                                     |
| `BOOTSTRAP_ADMIN_PASSWORD`         | (sem padrão)                                 | Senha do administrador inicial (10 a 128 caracteres). Ele nasce com troca de senha obrigatória. Nunca vai para o log                                                                          |
| `SEED_DEV_PASSWORD`                | `dev-only-pauta-2026`                        | Só do `npm run seed:dev`: senha dos usuários `dev.*@pauta.local` (lida direto do ambiente, não validada na subida da API)                                                                     |

## Scripts

| Script                                                       | O que faz                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `npm run start:dev`                                          | API em modo watch                                            |
| `npm run build` / `npm run start:prod`                       | Compila (`nest build` + `tsc-alias`) / roda `dist/main`      |
| `npm run validate`                                           | `biome ci .` + `tsc --noEmit` (inclui as regras de camada)   |
| `npm run check`                                              | Biome: corrige, formata e organiza imports                   |
| `npm run lint` / `npm run format` / `npm run typecheck`      | Lint, formatação e tipos isolados                            |
| `npm test` / `npm run test:watch`                            | Testes unitários (Vitest)                                    |
| `npm run test:cov`                                           | Relatório de cobertura v8 (sem meta mínima)                  |
| `npm run test:e2e`                                           | Testes e2e (`e2e/specs/**/*.e2e-spec.ts`), Postgres real     |
| `npm run migration:run` / `migration:revert`                 | Aplica / desfaz a última migration (`migration:show` lista)  |
| `npm run migration:create -- src/database/migrations/Nome`   | Cria uma migration vazia (nome `<epochms>-Nome.ts`)          |
| `npm run migration:generate -- src/database/migrations/Nome` | Compila e gera a migration a partir das entities             |
| `npm run migration:run:prod`                                 | Roda as migrations de `dist/` (usado pelo `api-migrate`)     |
| `npm run seed:dev`                                           | Compila e roda os seeds registrados (idempotentes)           |
| `npm run load:seed` / `npm run load:clean`                   | Cria / apaga a carga sintética de 5 mil pautas (banco local) |
| `npm run load:measure`                                       | Mede p50/p95/p99 das consultas da tela principal             |

Definition of Done: `npm run validate`, `npm test`, `npm run test:e2e` e `npm run build` verdes.

## Contrato HTTP

- Prefixo `/api` + versão por URI (`/api/v1/...`); `/health` e `/docs` ficam de fora.
- Lista paginada: `{ data, total, page, limit }` (`page` padrão 1; `limit` padrão 50, máximo 200). Lista vazia é `200` com `data: []`.
- Erro: `{ statusCode, code, message, fields? }`. `400 INVALID_REQUEST` traz `fields: [{ field, message }]` (o `message` continua em pt-BR; o `field` é o nome em inglês do campo de JSON).
- Todo response devolve `x-request-id` (reaproveita o enviado pelo cliente quando válido) e o mesmo id aparece em todos os logs da requisição (`request_id`).
- `GET /health` -> `200 { status: 'ok', info: { database: { status: 'up' } }, ... }` (terminus); `503` com `database: down` quando o banco não responde.

### Códigos de erro (`code`)

Definidos nesta base:

| `code`              | Status                                | Quando                                                                         |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `INVALID_REQUEST`   | 400 (e demais 4xx sem código próprio) | Corpo, query ou parâmetro inválido; JSON ilegível; corpo acima de 100 kb (413) |
| `UNAUTHENTICATED`   | 401                                   | Sem credencial válida                                                          |
| `FORBIDDEN`         | 403                                   | Autenticado, mas sem a permissão exigida                                       |
| `NOT_FOUND`         | 404                                   | Rota ou recurso inexistente (genérico)                                         |
| `TOO_MANY_REQUESTS` | 429                                   | Limite de requisições por minuto excedido                                      |
| `INTERNAL_ERROR`    | 5xx                                   | Falha inesperada (mensagem genérica; o detalhe fica no log)                    |

Autenticação e usuários (catálogo e exemplos de resposta em [`docs/auth.md`](./docs/auth.md)):

| `code`                     | Status | Quando                                                                                          |
| -------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS`      | 401    | E-mail inexistente **ou** senha errada (mesma resposta e mesmo tempo)                           |
| `ACCOUNT_LOCKED`           | 403    | Conta bloqueada por excesso de tentativas de login                                              |
| `USER_DEACTIVATED`         | 403    | Usuário desativado tentou entrar (depois de provar a senha) ou renovar a sessão                 |
| `PASSWORD_CHANGE_REQUIRED` | 403    | Token de senha provisória (claim `mcp`) em rota que não é troca de senha, logout ou `user-info` |
| `INVALID_REFRESH_TOKEN`    | 401    | Refresh token desconhecido, expirado, revogado ou reutilizado                                   |
| `INVALID_CURRENT_PASSWORD` | 400    | Senha atual incorreta na troca de senha                                                         |
| `WEAK_PASSWORD`            | 400    | Senha fora de 10 a 128 caracteres, ou nova senha igual à atual                                  |
| `INVALID_USER_NAME`        | 400    | Nome do usuário vazio ou com mais de 120 caracteres                                             |
| `INVALID_EMAIL`            | 400    | E-mail do usuário (e do responsável) fora do formato ou com mais de 254 caracteres              |
| `USER_NOT_FOUND`           | 404    | Id de usuário inexistente                                                                       |
| `EMAIL_ALREADY_REGISTERED` | 409    | Já existe usuário com o mesmo e-mail (sem diferenciar caixa), ativo ou desativado               |
| `USER_VERSION_OUTDATED`    | 409    | `version` do `PATCH /users/:id` diferente da atual                                              |
| `LAST_ADMIN`               | 409    | A operação deixaria o sistema sem administrador ativo                                           |
| `CANNOT_MODIFY_SELF`       | 409    | Desativar ou mudar o papel da própria conta                                                     |

Cadastros (empreendimentos e responsáveis):

| `code`                                                           | Status | Quando                                                                                                                      |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_REGISTRY_NAME`                                          | 400    | Nome vazio (após `trim`) ou com mais de 80 caracteres                                                                       |
| `INVALID_EMAIL`                                                  | 400    | E-mail do responsável fora do formato `algo@algo.algo` ou com mais de 254 caracteres                                        |
| `ESTATE_DEVELOPMENT_NOT_FOUND` / `OWNER_NOT_FOUND`               | 404    | Id inexistente                                                                                                              |
| `ESTATE_DEVELOPMENT_NAME_DUPLICATED` / `OWNER_NAME_DUPLICATED`   | 409    | Já existe cadastro com o mesmo nome ignorando caixa e acento; se o homônimo está arquivado, a mensagem orienta a reativá-lo |
| `ESTATE_DEVELOPMENT_VERSION_OUTDATED` / `OWNER_VERSION_OUTDATED` | 409    | `version` do `PATCH` diferente da atual (alterado por outra pessoa)                                                         |

Pautas:

| `code`                           | Status | Quando                                                                                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_TITLE`                  | 400    | Título vazio (após `trim`) ou com mais de 140 caracteres                                                                        |
| `INVALID_DESCRIPTION`            | 400    | Descrição com mais de 1200 caracteres (após `trim`)                                                                             |
| `INVALID_REQUEST`                | 400    | Também para prazo que passa do formato mas não é data existente (`2026-02-30`); sem `fields`, a `message` traz o valor recusado |
| `ESTATE_DEVELOPMENT_UNAVAILABLE` | 400    | Empreendimento atribuído (ou trocado) inexistente ou arquivado                                                                  |
| `OWNER_UNAVAILABLE`              | 400    | Responsável atribuído (ou trocado) inexistente ou arquivado                                                                     |
| `CONTENT_BRIEF_NOT_FOUND`        | 404    | Id inexistente ou pauta excluída                                                                                                |
| `CONTENT_BRIEF_VERSION_OUTDATED` | 409    | `version` do `PUT` ou do `PATCH .../status` diferente da atual (alterado por outra pessoa)                                      |

`INVALID_DATE` (do value object `CalendarDate`) não é código público: o prazo recusado vira `INVALID_REQUEST` na camada de aplicação. O catálogo completo está no plano técnico (§5.6) e no ADR-015.

## Autenticação e permissões

Autenticação **própria** da API (ADR-016, substitui o provedor de identidade externo da primeira versão): usuários e senhas ficam no Postgres, a API emite o access token (JWT HS256) e um refresh token opaco. Toda rota exige `Authorization: Bearer <access token>`, exceto `GET /health`, `POST /auth/login` e `POST /auth/refresh`. **Contrato completo, exemplos JSON, erros e fluxo de tokens para quem constrói a UI: [`docs/auth.md`](./docs/auth.md).**

- **Endpoints** (`/api/v1`): `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-password`, `GET /auth/user-info`, e a administração em `/users` (ver abaixo).
- **Access token:** JWT HS256, TTL `JWT_ACCESS_TTL` (15 min), claims `sub` (uuid), `email`, `name`, `role`, `iss`, `aud`. As permissões **não** vão no token: o servidor as deriva do `role`.
- **Refresh token:** 256 bits aleatórios (base64url), gravado só como hash SHA-256 em `refresh_tokens`; vale 7 dias e **uma única vez** (rotação a cada uso). Apresentar um refresh já usado revoga toda a família de sessões. Trocar ou redefinir a senha revoga todos os refresh tokens do usuário.
- **Papéis** (um por usuário): `admin`, `content-brief-editor`, `content-brief-viewer`. Mapa papel -> permissão (`src/modules/auth/domain/services/role-permissions.ts`, travado por spec):

| Permissão                                              | `admin` | `content-brief-editor` | `content-brief-viewer` |
| ------------------------------------------------------ | :-----: | :--------------------: | :--------------------: |
| `content-brief:read`                                   |   sim   |          sim           |          sim           |
| `content-brief:write` (criar, editar, mudar status)    |   sim   |          sim           |                        |
| `content-brief:delete`                                 |   sim   |          sim           |                        |
| `registry:read`                                        |   sim   |          sim           |          sim           |
| `registry:write` (criar, renomear, arquivar, reativar) |   sim   |          sim           |                        |
| `user:read`                                            |   sim   |                        |                        |
| `user:write` (criar, alterar, desativar, redefinir)    |   sim   |                        |                        |

- **Guards** (`APP_GUARD`, nesta ordem): `ThrottlerGuard` -> `AuthGuard` -> `PermissionsGuard`. O `AuthGuard` valida o JWT **localmente** (assinatura HS256, `iss`, `aud`, `exp`) e carrega o usuário das claims, **sem consultar o banco por requisição**. Consequência: desativar um usuário ou mudar o papel dele só vale nos tokens novos, no máximo `JWT_ACCESS_TTL` (15 min) depois; o refresh e o login são negados na hora. Falha de autenticação: `401 UNAUTHENTICATED`, sempre a mesma mensagem; o motivo (`reason`: `token_missing`, `invalid_format`, `invalid_signature`, `expired`, `invalid_issuer`, `invalid_audience`, `invalid_claims`) vai só para o log `auth.guard.rejected`, nunca o token. Token com a claim `mcp` (senha provisória pendente, `mustChangePassword`) só passa nas rotas `@AllowPendingPasswordChange()` (`POST /auth/change-password`, `POST /auth/logout`, `GET /auth/user-info`); nas demais: `403 PASSWORD_CHANGE_REQUIRED`. Falta de permissão: `403 FORBIDDEN`.
- **Nega por padrão:** toda rota declara `@Public()` (`/health`, login e refresh), `@Authenticated()` (só exige login) ou `@Permissions(...)` (exige todas). Rota sem nenhum dos três responde `403` e gera o log `auth.permissions.missing_decorator`.
- **Segurança do login:** `INVALID_CREDENTIALS` único para e-mail inexistente e senha errada, com equalização de tempo (hash descartável quando o e-mail não existe); `LOGIN_MAX_ATTEMPTS` falhas seguidas bloqueiam a conta por `LOGIN_LOCK_MINUTES` (contagem atômica no banco, sucesso zera); `@LoginThrottle()` aplica `LOGIN_THROTTLE_LIMIT_PER_MINUTE` por IP em login e troca de senha; senha em argon2id (`argon2`, OWASP 19 MiB / 2 iterações / 1 de paralelismo); senha, hash e token nunca vão para log nem para resposta (as respostas que carregam segredo levam `Cache-Control: no-store`).
- **Teste manual** (com `npm run seed:dev` e a API no ar):

```bash
LOGIN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"dev.editor@pauta.local","password":"dev-only-pauta-2026"}')
TOKEN=$(echo "$LOGIN" | jq -r .accessToken)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/auth/user-info
```

### Administração de usuários (`/api/v1/users`)

`user:read` para leitura, `user:write` para escrita (só o `admin`). Detalhes e exemplos em [`docs/auth.md`](./docs/auth.md).

| Rota                             | O que faz                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users`                     | Lista paginada (`{ data, total, page, limit }`), ordenada por nome. Filtros: `q` (nome ou e-mail, sem caixa e sem acento), `status` (`ACTIVE`/`DEACTIVATED`)         |
| `GET /users/:id`                 | Detalha um usuário                                                                                                                                                   |
| `POST /users`                    | Cria `{ name, email, role, password? }`. Sem `password`, gera senha provisória forte, devolvida **uma única vez** (`temporaryPassword`); `mustChangePassword = true` |
| `PATCH /users/:id`               | Altera `{ name?, role?, version }` (concorrência otimista; 409 se a versão mudou)                                                                                    |
| `POST /users/:id/deactivate`     | Desativa e revoga as sessões (idempotente)                                                                                                                           |
| `POST /users/:id/reactivate`     | Reativa e destrava (idempotente)                                                                                                                                     |
| `POST /users/:id/reset-password` | Gera nova senha provisória (única vez), exige troca, destrava a conta e revoga as sessões                                                                            |

Regras: não pode desativar nem mudar o papel da **própria** conta (`CANNOT_MODIFY_SELF`); não pode desativar nem rebaixar o **último admin ativo** (`LAST_ADMIN`, garantido também no banco contra requisições simultâneas); e-mail único sem diferenciar caixa, inclusive entre desativados (`EMAIL_ALREADY_REGISTERED`); senha de 10 a 128 caracteres (`WEAK_PASSWORD`). Nenhuma resposta traz hash nem token.

### Administrador inicial (bootstrap) e usuários de desenvolvimento

- **Bootstrap:** ao subir, se **não existe nenhum usuário** e `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` estão definidas, a API cria o admin com `mustChangePassword = true`. É idempotente (com qualquer usuário na tabela, não faz nada) e registra só o e-mail. Sem usuários e sem as variáveis, a API sobe e registra um aviso claro (`user.bootstrap_admin`, `reason: not_configured`).
- **Seed de desenvolvimento** (`npm run seed:dev`, só `STAGE=local` ou `demo`; recusa produção e `e2e`): cria `dev.admin@pauta.local`, `dev.editor@pauta.local` e `dev.leitor@pauta.local` com a **senha só de desenvolvimento** `dev-only-pauta-2026` (pública; `SEED_DEV_PASSWORD` a sobrescreve) e `mustChangePassword = false`. Idempotente; não altera a senha de quem já existe.

## Cadastros: empreendimentos e responsáveis

Listas de apoio das pautas (no protótipo eram nomes livres deduplicados sem acento e sem caixa). Dois agregados em módulos separados (`src/modules/estate-development`, `src/modules/owner`), com domínio explícito, e o value object compartilhado `RegistryName` (`src/shared/domain/registry-name.ts`).

| Rota (`/api/v1`)                           | Permissão        | Corpo               | Resposta                                                 |
| ------------------------------------------ | ---------------- | ------------------- | -------------------------------------------------------- |
| `GET /estate-developments?includeArchived` | `registry:read`  | (nenhum)            | `200` array ordenado por nome (pt-BR), máximo 500        |
| `POST /estate-developments`                | `registry:write` | `{ name }`          | `201` · `400` · `409 *_NAME_DUPLICATED`                  |
| `PATCH /estate-developments/:id`           | `registry:write` | `{ name, version }` | `200` · `400` · `404` · `409` (nome duplicado ou versão) |
| `POST /estate-developments/:id/archive`    | `registry:write` | (nenhum)            | `200` (idempotente) · `404`                              |
| `POST /estate-developments/:id/reactivate` | `registry:write` | (nenhum)            | `200` (idempotente) · `404`                              |

`/owners` tem as mesmas rotas e aceita também `email` (opcional) em `POST` e `PATCH`: no `PATCH`, `email` omitido mantém o atual; `null` ou em branco remove. Resposta de ambos:

```ts
{ id: string; name: string; email?: string | null /* só owners */; active: boolean; version: number; openContentBriefs: number }
```

- **Nome:** `trim`, espaços internos colapsados, 1 a 80 caracteres. Único ignorando caixa e acento (`Residencial Ipê` = `residencial ipe`), **inclusive entre arquivados**: reativar nunca conflita. O `normalized_name` (chave do índice único) é calculado no domínio.
- **Arquivar** não apaga: o cadastro some da lista padrão (e do seletor de pauta nova), mas as pautas existentes continuam mostrando o nome. Arquivar e reativar são idempotentes (repetir devolve `200` sem mudar a `version`).
- **Concorrência otimista** (ADR-006): `PATCH` exige a `version` lida; divergência devolve `409 *_VERSION_OUTDATED`. A coluna `version` sobe a cada gravação.
- **`openContentBriefs`:** número de pautas não excluídas e não concluídas (`status <> 'DONE'`) que usam o cadastro (aviso antes de arquivar); cadastro arquivado continua contando. É uma subconsulta de leitura sobre `content_briefs` no `*QueryRepository` de cada módulo, sem importar o módulo de pautas.
- **Logs:** `estate_development.created|renamed|archived|reactivated` (idem `owner.*`) com `outcome` (`success`, `skipped` quando já estava no estado pedido, `blocked` para nome duplicado) e `estate_development_id`/`owner_id`. O e-mail nunca é logado.

## Pautas

Agregado central (`src/modules/content-brief`), com domínio explícito: `ContentBriefDomainEntity`, value objects `Title` e `Description`, enums `ContentBriefStatus|Action|Channel` e `DueStatus`, serviço puro `classifyDueDate` (ADR-005). Referencia empreendimento e responsável **só por id**; para saber se estão ativos, consulta as tabelas deles por SQL somente leitura (`RegistryQueryRepository`), sem importar os módulos. Leitura em dois lados (CQRS leve): a escrita passa pelo agregado; a listagem, o resumo e o detalhe saem de `ContentBriefQueryRepository` (SQL de leitura, devolve `ContentBriefReadModel`) e o `dueStatus` de cada item é aplicado pela query com `classifyDueDate`.

| Rota (`/api/v1`)                   | Permissão              | Corpo                                                                                           | Resposta                                   |
| ---------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `GET /content-briefs`              | `content-brief:read`   | (query: ver "Listagem e resumo")                                                                | `200 { data, total, page, limit }` · `400` |
| `GET /content-briefs/summary`      | `content-brief:read`   | (query: filtros comuns)                                                                         | `200 ContentBriefSummary` · `400`          |
| `POST /content-briefs`             | `content-brief:write`  | `{ title, description?, dueDate?, status?, action?, channel?, estateDevelopmentId?, ownerId? }` | `201 ContentBriefResponse` · `400`         |
| `GET /content-briefs/:id`          | `content-brief:read`   | (nenhum)                                                                                        | `200` · `404`                              |
| `PUT /content-briefs/:id`          | `content-brief:write`  | os mesmos campos do `POST` + `version`                                                          | `200` · `400` · `404` · `409`              |
| `PATCH /content-briefs/:id/status` | `content-brief:write`  | `{ status, version }`                                                                           | `200` · `400` · `404` · `409`              |
| `DELETE /content-briefs/:id`       | `content-brief:delete` | (nenhum)                                                                                        | `204` · `404`                              |

```ts
type ContentBriefResponse = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null; // 'YYYY-MM-DD'
  dueStatus:
    | 'overdue'
    | 'today'
    | 'next-7-days'
    | 'later'
    | 'no-due-date'
    | 'completed';
  daysUntilDue: number | null; // negativo quando passou
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  action:
    | 'CHASE'
    | 'DEVELOP'
    | 'PAYMENT'
    | 'CREATE'
    | 'FOLLOW_UP'
    | 'ANALYZE'
    | null;
  channel:
    | 'INSTAGRAM'
    | 'EMAIL'
    | 'BLOG'
    | 'ADS'
    | 'VIDEO'
    | 'WEBSITE'
    | 'REPORT'
    | 'OTHER'
    | null;
  estateDevelopment: { id: string; name: string; active: boolean } | null;
  owner: { id: string; name: string; active: boolean } | null;
  completedAt: string | null; // ISO-8601 UTC
  version: number;
  createdAt: string;
  createdBy: { id: string; name: string | null };
  updatedAt: string;
  updatedBy: { id: string; name: string | null };
};
```

- **Título** `trim`, 1 a 140 caracteres; **descrição** `trim`, 0 a 1200 (ausente ou `null` vira texto vazio). Contam caracteres Unicode, não unidades UTF-16.
- **`PUT` é substituição completa:** campo ausente (ou `null`) **limpa** o valor (descrição vazia; prazo, ação, canal, empreendimento e responsável `null`). Só `status` ausente mantém o atual. O front deve sempre mandar todos os campos. `POST` com `status` ausente usa `TODO`.
- **Prazo (`dueDate`):** data de calendário `YYYY-MM-DD`, sem hora. A coluna é `date`; o `pg` converteria `date` em `Date` e deslocaria o dia, então a leitura usa `to_char(...)` e a entity do TypeORM hidrata o `date` como texto (coberto no e2e com `2026-11-14` em vários fusos do processo). Data inexistente (`2026-02-30`) devolve `400 INVALID_REQUEST` (escolha de contrato: `INVALID_DATE` não é código público).
- **Situação do prazo** (`dueStatus`, `daysUntilDue`): calculada a cada leitura para "hoje" em `APP_TIMEZONE` (tabela do ADR-005): concluída vence tudo; sem prazo; `< hoje` atrasada; `= hoje`; até `hoje + 7` próximos 7 dias; senão mais adiante. Não é gravada.
- **Cadastros:** `estateDevelopmentId`/`ownerId` precisam existir e estar ativos **ao serem atribuídos** (criar ou trocar); manter um já atribuído e depois arquivado é permitido (a pauta mostra `active: false`), e trocar só o status nunca valida cadastros.
- **Status livre** entre os quatro valores. Entrar em `DONE` grava `completedAt` (instante do relógio); sair limpa; repetir `DONE` mantém o instante original.
- **Concorrência otimista** (ADR-006): `PUT` e `PATCH .../status` exigem a `version` lida; o `UPDATE ... WHERE id AND version AND deleted_at IS NULL` garante a checagem também em corrida (sem linha afetada, recarrega para separar `404` de `409 CONTENT_BRIEF_VERSION_OUTDATED`). Excluir não exige `version`.
- **Exclusão lógica:** `DELETE` grava `deleted_at`/`deleted_by`; a pauta passa a responder `404` em todas as rotas e deixa de contar em `openContentBriefs`.
- **Auditoria:** `createdBy`/`updatedBy` vêm do token (`sub`, o uuid do usuário, e `name`, snapshot).
- **Logs:** `content_brief.created|updated|status_changed|deleted` (`outcome: success`) e `content_brief.version_conflict` (`warn`, `blocked`, com `operation`), sempre com `content_brief_id` e `user_sub`. Título e descrição nunca são logados.

### Listagem e resumo (`GET /content-briefs`, `GET /content-briefs/summary`)

Parâmetros de query (todos opcionais; valor inválido devolve `400 INVALID_REQUEST` com `fields: [{ field, message }]`, e parâmetro desconhecido também):

| Parâmetro             | Lista | Resumo | Valores                                                                               |
| --------------------- | :---: | :----: | ------------------------------------------------------------------------------------- |
| `dueStatus`           |  sim  | ignora | CSV de `overdue,today,next-7-days,later,no-due-date,completed`; `OR` entre os valores |
| `status`              |  sim  |  sim   | CSV de `TODO,IN_PROGRESS,IN_REVIEW,DONE`; `OR` entre os valores                       |
| `estateDevelopmentId` |  sim  |  sim   | uuid, ou `none` (pautas sem empreendimento)                                           |
| `ownerId`             |  sim  |  sim   | uuid, ou `none` (pautas sem responsável)                                              |
| `action`              |  sim  |  sim   | `CHASE,DEVELOP,PAYMENT,CREATE,FOLLOW_UP,ANALYZE`                                      |
| `q`                   |  sim  |  sim   | 2 a 100 caracteres (após `trim`)                                                      |
| `sort`                |  sim  | ignora | `dueDate` (padrão), `-dueDate` ou `updatedAt`                                         |
| `page` / `limit`      |  sim  | ignora | `page` a partir de 1 (padrão 1); `limit` de 1 a 200 (padrão 50)                       |

Filtros diferentes combinam com `AND`. Pauta excluída (soft delete) nunca aparece em nenhuma das duas rotas.

- **`dueStatus` em SQL, nunca no cliente:** a API traduz cada situação para um predicado de datas com o "hoje" do `ClockInterface` (`APP_TIMEZONE`), a mesma tabela do ADR-005. Com `hoje = H`: `overdue` = aberta com prazo `< H`; `today` = `= H`; `next-7-days` = `H+1 .. H+7`; `later` = `> H+7`; `no-due-date` = aberta sem prazo; `completed` = `DONE` (com ou sem prazo, **nunca** `overdue`). Cada item da resposta traz `dueStatus` e `daysUntilDue` do mesmo "hoje" (`classifyDueDate`), e um teste e2e confere que o filtro SQL e a classificação em memória concordam em todas as fronteiras (−1, 0, +1, +7, +8 dias, sem prazo, concluída vencida).
- **Busca (`q`):** sem caixa e sem acento (`plantao` encontra `plantão`), como substring em título, descrição, nome do empreendimento, nome do responsável e rótulos de ação e canal (`cobrar`, `anuncios`). Usa `lower(immutable_unaccent(...))` dos dois lados num `LIKE ... ESCAPE '\'`; `\`, `%` e `_` do texto digitado são escapados (`100%` não vira curinga). Os rótulos (`ACTION_LABEL`, `CHANNEL_LABEL`) entram como JSON por parâmetro, nunca interpolados.
- **Ordenação:** `dueDate` = prazo crescente, **sem prazo por último**, desempate por título com a colação `pt_br` (como o `cmpDate()` do protótipo) e por id; `-dueDate` = prazo decrescente, ainda com sem prazo por último (usado nas concluídas); `updatedAt` = alteradas mais recentemente primeiro.
- **Paginação:** `{ data, total, page, limit }`; `total` é uma consulta à parte (continua correto numa página além da última, que devolve `200` com `data: []`).
- **Resumo:** `{ today, total, byDueStatus, byStatus }` com **todas as chaves** (zero quando vazio), numa única consulta com `COUNT(*) FILTER`. `today` é o dia de referência (`YYYY-MM-DD`, `APP_TIMEZONE`). `dueStatus`, `page`, `limit` e `sort` são aceitos e ignorados, então cada chip da tela mostra quantas pautas teria mesmo com outro selecionado.

```ts
type ContentBriefSummary = {
  today: string; // 'YYYY-MM-DD'
  total: number;
  byDueStatus: Record<
    'overdue' | 'today' | 'next-7-days' | 'later' | 'no-due-date' | 'completed',
    number
  >;
  byStatus: Record<'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE', number>;
};
```

```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:3000/api/v1/content-briefs?dueStatus=overdue,today&ownerId=none&q=plantao&sort=dueDate&limit=50'
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/v1/content-briefs/summary?q=plantao'
```

### Seed de desenvolvimento

`npm run seed:dev` (compila e roda `dist/database/seeds/run-seed.js`; só roda com `STAGE=local` ou `demo`, recusa produção e `e2e`) cria antes os três usuários de desenvolvimento (seção "Autenticação e permissões") e então os empreendimentos "Residencial Exemplo" e "Comercial Exemplo", os responsáveis "Ana" e "Bruno" e as 6 pautas do array `EXEMPLOS` do protótipo (textos em português, enums em inglês), com prazos relativos a "hoje" no fuso `APP_TIMEZONE`, de modo que a tela mostre as seis situações: atrasada (−2), hoje (0), próximos 7 dias (+2), mais adiante (+9), sem prazo e concluída (−4). Dois prazos diferem do protótipo, que não tinha pauta para hoje nem sem prazo: o pagamento da agência vence hoje (era +5) e o acompanhamento de leads do Google Ads fica sem prazo (era +14).

- **Idempotente:** cadastros por nome normalizado (`ON CONFLICT`); a pauta de exemplo não é recriada se já existe uma não excluída do autor `seed` com o mesmo título. Rodar duas vezes não duplica (coberto no e2e). Os prazos não "andam" numa segunda rodada em outro dia: para renovar, apague o seed e rode de novo.
- Autor da auditoria: `{ id: 'seed', name: 'Seed de desenvolvimento' }`.
- As pautas e os cadastros novos gravam em `created_by`/`updated_by` o **uuid do usuário** (o `id` do `users`), e o nome é um snapshot.
- O banco de desenvolvimento fica **sem pautas** até alguém rodar o seed. Para desfazê-lo: `DELETE FROM content_briefs WHERE created_by = 'seed'` e o mesmo em `owners` e `estate_developments` (nessa ordem).

### Carga e desempenho (5 mil pautas)

`npm run load:seed` (`scripts/seed-load.ts`) apaga e recria uma carga sintética (30 empreendimentos, 15 responsáveis, **5.000 pautas** com prazos de 60 dias atrás a 90 à frente, 8% sem prazo, status 30% `TODO`, 25% `IN_PROGRESS`, 10% `IN_REVIEW`, 35% `DONE`; gerador determinístico) e `npm run load:clean` a apaga. Tudo que o script grava tem `created_by = 'load-test'`, e só isso é apagado. **Recusa qualquer banco que não seja local** (`localhost`, `127.0.0.1`, `::1`). `npm run load:measure` (`scripts/measure-load.ts`, só `fetch`) mede cada consulta com 200 requisições (concorrência 8, 10 de aquecimento) e sai com erro se algum p95 passar de `TARGET_MS` (padrão 300):

```bash
npm run build && STAGE=local THROTTLE_LIMIT_PER_MINUTE=1000000 LOG_LEVEL=warn node dist/main.js &
npm run seed:dev && npm run load:seed
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"dev.editor@pauta.local","password":"dev-only-pauta-2026"}' | jq -r .accessToken) npm run load:measure
npm run load:clean
```

Medição de 14/11/2026 (máquina de desenvolvimento, Postgres 18 em contêiner na porta 5433, API compilada, JWT real validado a cada chamada, 5.000 pautas; medição anterior ao ADR-016, quando a validação era por chave pública remota (o HS256 atual é local e mais barato)). Meta do plano técnico (§8): **p95 < 300 ms**.

| Consulta                                                                                     | média (ms) |  p50 |      p95 |  p99 |
| -------------------------------------------------------------------------------------------- | ---------: | ---: | -------: | ---: |
| `GET /content-briefs?dueStatus=overdue,today,next-7-days,later,no-due-date&limit=200`        |       18.0 | 15.3 | **35.6** | 50.9 |
| `GET /content-briefs?dueStatus=completed&sort=-dueDate&limit=50`                             |        7.5 |  7.2 | **12.0** | 14.3 |
| `GET /content-briefs/summary`                                                                |        2.7 |  2.3 |  **4.9** |  5.8 |
| `GET /content-briefs?dueStatus=<5 abertas>&q=plantao&limit=200` (a busca casa ~1.600 pautas) |       41.4 | 40.7 | **54.8** | 65.9 |
| `GET /content-briefs/summary?q=plantao`                                                      |       30.1 | 30.0 | **35.4** | 39.5 |

Todos com folga de mais de 5x sobre a meta, então **nenhum índice novo foi criado**. `EXPLAIN (ANALYZE)` das três consultas: a lista usa o índice parcial `ix_content_briefs_open_due_date` com `Incremental Sort` (execução de 1,1 ms); o resumo é um `Seq Scan` de 5.000 linhas com uma única agregação (0,8 ms); a busca é `Seq Scan` + `Hash Left Join` com `top-N heapsort` (12,6 ms de execução; o resto da latência é rede, JSON e `unaccent` por linha). Os dados sintéticos foram apagados do banco de desenvolvimento depois da medição.

## Banco de dados e migrations

- Postgres 18, TypeORM com `synchronize: false` e `migrationsRun: false`: o esquema só muda por migration, rodada por comando (nunca no boot).
- Migrations em `src/database/migrations/<epochms>-Nome.ts`. A conexão e as opções do TypeORM saem de `src/database/typeorm.config.ts` (`buildDataSourceOptions()` + `DataSource` exportado por padrão), usado pelo `DatabaseModule` do Nest e pela CLI. Os comandos `migration:run|revert|show` executam esse arquivo direto do TypeScript (type stripping do Node 26), por isso migrations e `typeorm.config.ts` não usam o alias `@/` nem decorators. `migration:generate`, `migration:run:prod` e `seed:dev` usam `dist/`, onde as entities (`*.entity.ts`) são carregadas pelo glob. A conexão vem das variáveis `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASS`, `DATABASE_NAME` e `DATABASE_SSL` (para Neon/produção: `DATABASE_SSL=true`). Nunca edite uma migration já aplicada (única exceção, feita uma vez: ver abaixo); teste `up -> down -> up`.
- Colunas em snake_case por `SnakeNamingStrategy`; colunas de auditoria (`created_at`, `created_by`, `created_by_name`, `updated_*`) pelo embedded `AuditColumns` + `applyAudit(...)`.
- A primeira migration cria `unaccent`, a função `immutable_unaccent(text)` (o `unaccent` puro não é `IMMUTABLE` e não serve em índice) e a colação ICU `pt_br`.
- A segunda (`CreateEstateDevelopmentsAndOwners`) cria `estate_developments` e `owners`, com índice único em `normalized_name` (`ux_estate_developments_name`, `ux_owners_name`). `normalized_name` é `varchar(240)` (o `name` é `varchar(80)`) porque a decomposição Unicode pode alongar o texto. A lista de cadastros ordena por `name COLLATE "pt_br"`.
- A terceira (`CreateContentBriefs`) cria os enums `content_brief_status`, `content_brief_action`, `content_brief_channel` e a tabela `content_briefs` (índices parciais `ix_content_briefs_*`, só pautas não excluídas).
- A quarta e a quinta (`CreateUsers`, `CreateRefreshTokens`, ADR-016) criam os enums `user_role` e `user_status`, `users` (índice único `ux_users_email` sobre `lower(email)`) e `refresh_tokens` (`ux_refresh_tokens_token_hash` único, `ix_refresh_tokens_family_id`, `ix_refresh_tokens_user_id`). A sexta (`RenameOwnerUserIdColumn`) renomeia a coluna de vínculo externo de `owners` para `user_id` (vínculo opcional com `users`, sem FK, sem uso no MVP). Essas três são **migrations novas**: as anteriores não foram reescritas.
- **Renomeação ADR-015 (feita uma única vez):** por ser uma POC sem dado real e sem migration aplicada fora da máquina de desenvolvimento, as migrations `CreateCadastros` e `CreatePautas` foram reescritas no lugar com nomes em inglês (hoje `CreateEstateDevelopmentsAndOwners` e `CreateContentBriefs`) e o banco de desenvolvimento foi recriado. A partir daqui, migration aplicada não se edita.
- Seeds: `src/database/seeds/` (lista em `seeds.ts`: `dev-users.seed.ts` e `prototype-examples.seed.ts`), idempotentes; `npm run seed:dev` só roda com `STAGE=local` ou `demo`. Detalhes na seção "Seed de desenvolvimento".

### Relógio e datas

`ClockInterface` (`shared/application/interfaces/clock.interface.ts`, token `CLOCK`) devolve `today(): CalendarDate` no fuso `APP_TIMEZONE` e `now(): Date`. `CalendarDate` (`shared/domain/calendar-date.ts`) é a data sem hora (`YYYY-MM-DD`). Testes usam `FixedClock` (`shared/infrastructure/clock/fixed-clock.ts`). Data inválida lança `INVALID_DATE` (erro de domínio); no prazo das pautas o use case a traduz para `INVALID_REQUEST`.

## Testes e2e

`npm run test:e2e` sobe o `AppModule` real contra **Postgres 18 real**: o `globalSetup` (`e2e/src/runner/global-setup.ts`) inicia um contêiner efêmero via Testcontainers (Docker precisa estar rodando) e aplica as migrations. O contêiner entrega host, porta, usuário, senha e banco, e o bootstrap os injeta como `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASS`, `DATABASE_NAME` e `DATABASE_SSL=false`. Se `E2E_DATABASE_HOST` estiver definida (junto com `E2E_DATABASE_PORT`, `E2E_DATABASE_USER`, `E2E_DATABASE_PASS` e `E2E_DATABASE_NAME`), usa esse banco no lugar do contêiner:

```bash
docker compose -f docker/compose.yaml --profile db up -d
E2E_DATABASE_HOST=localhost E2E_DATABASE_PORT=5433 E2E_DATABASE_USER=pauta E2E_DATABASE_PASS=pauta E2E_DATABASE_NAME=pauta npm run test:e2e
```

Atenção: os specs executam `cleanDatabase()` (`TRUNCATE` das tabelas de negócio) em `beforeEach`; com `E2E_DATABASE_HOST`, use um banco que possa ser apagado. A auth é a real e hermética (ADR-009, ADR-016): JWT HS256 com o segredo de desenvolvimento e argon2id. O `bootstrapApp` preenche `TOKENS.admin|editor|viewer|unknownRole` (`e2e/src/core/tokens.ts`) com access tokens emitidos pelo `TokenService` da aplicação (passe-os em `client.get(url, { token })`; o `sub` deles não existe em `users`, o guard não consulta o banco) e `forgeAccessToken(...)` fabrica tokens expirados, adulterados ou de outro segredo. Para fluxos com usuário real (login, refresh, bloqueio, administração) use `createUser(e2e, ...)` e `loginAs(e2e, user)` de `e2e/src/core/users.ts`. `e2e.clock.advanceMinutes(n)` avança o relógio dentro do dia (fim do bloqueio de login). `bootstrapApp({ env, providers, today })` (`e2e/src/runner/app-bootstrap.ts`) aceita variáveis de ambiente, `overrideProvider` e o dia do relógio fixo (padrão `2026-11-14`; `e2e.clock.setToday(...)` muda por spec).

## Estrutura

```
src/
├── main.ts, app.module.ts, app.setup.ts   # bootstrap, módulo raiz e configuração HTTP compartilhada
├── config/                                 # validação das variáveis de ambiente
├── database/                               # DatabaseModule, typeorm.config (Nest + CLI), migrations, seeds
├── shared/
│   ├── domain/                             # DomainEntity, ValueObject, DomainError, Actor, CalendarDate, RegistryName, Audit
│   ├── application/interfaces/             # interfaces compartilhadas (logger, clock, password hasher)
│   ├── infrastructure/{logger,filters,http,persistence,clock,security}
│   └── utils/
├── modules/auth/                           # login, refresh, logout, troca de senha, guards, decorators, TokenService, mapa papel -> permissão, /auth/*
├── modules/user/                           # usuários e refresh_tokens: domínio, administração (/users), bootstrap do admin
├── modules/estate-development/             # cadastro de empreendimentos (domain, application, infrastructure)
├── modules/owner/                          # cadastro de responsáveis (idem, com e-mail)
├── modules/content-brief/                  # pautas: domínio, interfaces, use cases/queries, persistência e controller (escrita, lista, resumo, GET por id)
└── modules/health/
e2e/                                        # globalSetup (Testcontainers), bootstrap do Nest, cliente HTTP e specs
scripts/                                    # carga sintética (seed-load.ts) e medição de latência (measure-load.ts)
docker/compose.yaml                         # Postgres local (perfil `db`)
docs/auth.md                                # contrato de autenticação e de /users (base da UI)
```

## Docker

```bash
docker build -t pauta-mkt-api .             # imagem de produção (Node 26.13.1 alpine, usuário node)
docker run --rm -p 3000:3000 pauta-mkt-api
```

O `Dockerfile` tem os estágios `base`, `development`, `build` e `production`; o `HEALTHCHECK` consulta `/health`. A stack completa da demonstração (API + UI + Postgres) fica no repositório da UI; na demo (`STAGE=demo`) a API exige `JWT_SECRET` e `CORS_ORIGINS`, e o `npm run seed:dev` cria os usuários `dev.*@pauta.local`.

## Convenções

- Mensagens de commit seguem Conventional Commits (`feat:`, `fix:`, `chore:`).
- Padrão de nomes (ADR-015): todo identificador (pastas, arquivos, classes, métodos, rotas, campos de JSON, tabelas, `code` de erro, eventos de log, papéis) é em inglês. Continuam em pt-BR os textos que o usuário vê, o `message` das respostas e dos logs, comentários, descrições de teste e documentação. Em particular: `Entity` é o objeto do ORM (`OwnerEntity`, pasta `infrastructure/persistence/entities`, arquivo `*.entity.ts`) e `DomainEntity` é a entidade de domínio (`OwnerDomainEntity`, `domain/entities/*.domain-entity.ts`). Controllers e quem consome use cases dependem da interface (`CreateOwnerUseCaseInterface`, token `CREATE_OWNER_USE_CASE`), nunca da classe concreta. Detalhes na seção "Padrão de nomes (ADR-015)" do [`CLAUDE.md`](./CLAUDE.md).
- Sem CI na POC: o Definition of Done acima substitui o pipeline.
