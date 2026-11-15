# CLAUDE.md — Pauta de marketing Bora (API)

Documento que os agentes leem primeiro. É direto de propósito: em caso de dúvida, copie o padrão que já existe em `src/shared` e `src/modules/health`.

## 0. Regras de trabalho

- **Commits só quando o dono pedir.** O repositório é público: nunca versione segredo, `.env`, caminho pessoal nem nome de sistema interno. Mensagens em Conventional Commits (`feat:`, `fix:`, `chore:`).
- Tudo é local. Banco e demais serviços sobem por `docker compose` na máquina (`docker/compose.yaml`). Postgres de desenvolvimento no host **5433**; API 3000; UI 5173. A autenticação é própria da API (ADR-016): não há provedor de identidade externo.
- Node **26.13.1** (`.nvmrc`). Em shell novo: `source ~/.nvm/nvm.sh && nvm use 26.13.1`. Versões em `package.json` são exatas (`save-exact`); não altere nem acrescente dependência sem autorização do prompt da tarefa.
- Não desative teste, lint ou tipo para passar (nada de `skip`, `any` para calar compilador, `biome-ignore` ou `@ts-expect-error` sem justificativa no relatório).
- Segredo nunca entra no repo: `.env.example` só com placeholder; não toque em `.env`.
- Fique no escopo da tarefa; problema adjacente vai para "Achados fora de escopo" no relatório.

## 1. Stack

NestJS 11 (CommonJS), TypeScript 5, Express, TypeORM 0.3 + `@nestjs/typeorm` 11 + `pg`, `uuid`, `class-validator`/`class-transformer`, `@nestjs/config` (validação por classe), `@nestjs/swagger`, `@nestjs/terminus`, `@nestjs/throttler`, `jsonwebtoken` (JWT HS256), `argon2` (hash de senha), Winston + `nest-winston`, `helmet`. Testes: Vitest + `unplugin-swc`. Lint/format: Biome 2. Sem Jest, ESLint ou Prettier.

## 2. Comandos (Definition of Done)

```bash
npm run validate      # biome ci . + tsc --noEmit
npm test              # vitest run (unitários, src/**/*.spec.ts)
npm run test:e2e      # e2e/specs/**/*.e2e-spec.ts (Postgres real via Testcontainers; `E2E_DATABASE_HOST` (+ `E2E_DATABASE_PORT|USER|PASS|NAME`) usa um banco existente)
npm run build         # nest build + tsc-alias (resolve o alias @/)
```

Outros: `npm run check` (Biome corrige e organiza imports), `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test:cov` (relatório v8, sem meta mínima: ADR-007), `npm run start:dev`.
Migration nova: testar `up -> down -> up` (`migration:run`, `migration:revert`, `migration:run`). README e `.env.example` atualizados quando houver endpoint, env, regra ou código de erro novo.

## 3. Arquitetura em camadas (ADR-002)

Um contexto de negócio ("Planejamento de marketing") com agregados em módulos separados (`content-brief`, `estate-development`, `owner`), mais `auth`, `user` (identidade: usuários, refresh tokens, administração) e `health`. Linguagem ubíqua em inglês (`ContentBrief`, `ContentBriefStatus`, `CreateContentBriefUseCase`; glossário no ADR-015); textos ao usuário, `message` de erro e logs em pt-BR. Rotas em inglês (`/estate-developments`, `/owners`, `/content-briefs`).

Modelo de módulo (referência: módulo `content-brief`):

```
src/modules/content-brief/
├── content-brief.module.ts
├── domain/                                     # TypeScript puro
│   ├── entities/content-brief.domain-entity.ts # agregado `ContentBriefDomainEntity` (construtor privado + create()/restore())
│   ├── value-objects/{title,description}.ts
│   ├── enums/{content-brief-status,content-brief-action,content-brief-channel,due-status}.ts
│   ├── services/classify-due-date.ts           # função pura (ADR-005)
│   └── errors/content-brief.errors.ts          # subclasses de DomainError com code próprio
├── application/                                # depende só de domain/ e de interfaces
│   ├── interfaces/repositories/
│   │   ├── content-brief.repository.interface.ts        # ContentBriefRepositoryInterface + CONTENT_BRIEF_REPOSITORY (Symbol)
│   │   ├── content-brief-query.repository.interface.ts  # ...QueryRepositoryInterface + CONTENT_BRIEF_QUERY_REPOSITORY, retorna ContentBriefReadModel
│   │   └── registry-query.repository.interface.ts       # anticorrupção: status de estate development/owner
│   ├── use-cases/{create-content-brief,update-content-brief,change-content-brief-status,delete-content-brief,common}/
│   │   └── <verb>-<noun>.use-case.ts + .use-case.interface.ts  # classe + CreateContentBriefUseCaseInterface/CREATE_CONTENT_BRIEF_USE_CASE (+ tipos de input)
│   ├── queries/{find-content-brief-by-id,list-content-briefs,summarize-content-briefs}/   # idem: .query.ts + .query.interface.ts
│   └── providers/                              # 1 provider por use case/query (<verb>-<noun>.provider.ts)
└── infrastructure/
    ├── http/
    │   ├── controllers/content-brief.controller.ts     # POST, PUT, PATCH /:id/status, DELETE, GET (lista), GET /summary (antes de GET /:id), GET /:id
    │   ├── dtos/{create-content-brief.request.dto.ts, list-content-briefs.query.dto.ts, ..., content-brief.response.dto.ts}
    │   └── presenters/content-brief.presenter.ts       # funções puras to<Recurso>Response
    └── persistence/
        ├── entities/content-brief.entity.ts            # ContentBriefEntity: @Entity('content_briefs') (ORM)
        ├── mappers/content-brief.mapper.ts             # entity (ORM) <-> entidade de domínio (toDomain/toEntity)
        └── repositories/{content-brief/{content-brief.repository.ts,content-brief-query.repository.ts,content-brief-filter.sql.ts},registry/registry-query.repository.ts}
```

Regras de dependência (**verificadas pelo `npm run validate`**, `noRestrictedImports` do Biome em `biome.json`, ADR-013):

1. `**/domain/**`: proibido `@nestjs/*`, `typeorm`, `class-validator`, `class-transformer` e qualquer caminho com `/application/` ou `/infrastructure/`. Pode importar de `@/shared/domain`.
2. `**/application/**`: proibido `typeorm` e qualquer caminho com `/infrastructure/`.
3. `infrastructure` implementa as interfaces; o mapper converte `entity (ORM) <-> entidade de domínio`.
4. Agregados se referenciam **por id** (`ContentBrief.estateDevelopmentId`), nunca por objeto.
5. Nenhum módulo Nest importa outro módulo de negócio; a comunicação é por interface + SQL somente leitura (plan §3.2). **Única exceção (ADR-016):** `AuthModule` importa `UserModule` e usa as portas que ele exporta (`USER_REPOSITORY`, `REFRESH_TOKEN_REPOSITORY`), porque autenticar é ler e atualizar usuários; `UserModule` nunca importa `AuthModule` (só reaproveita `Role`, `Permission` e os decorators como arquivos).

Consequência prática: o que casos de uso precisam de `shared` (logger, relógio) vive em `src/shared/application/interfaces/` (interface + `Symbol`), nunca em `shared/infrastructure`. O helper `toErrorLogFields` está em `src/shared/utils/` pelo mesmo motivo.

Árvore de `shared` hoje: `domain/{domain-entity,value-object,actor,audit,calendar-date,registry-name,errors/domain-error}.ts`, `application/interfaces/{logger.service.interface,clock.interface,password-hasher.interface}.ts`, `utils/error-log-fields.ts`, `infrastructure/{logger,filters,http,persistence,clock,security}`.

## 4. Padrões não negociáveis

### 4.1 Use case / query

- Classe **pura**: sem `@Injectable`, sem import de `@nestjs/*`. Recebe portas no construtor.
- O controller mapeia DTO -> input próprio do use case (o use case nunca recebe DTO nem request). Quem executa a ação entra como `Actor { id, name }`.
- Cada use case/query tem uma interface em arquivo irmão (`<verb>-<noun>.use-case.interface.ts` / `.query.interface.ts`) com `<Verb><Noun>UseCaseInterface` (ou `...QueryInterface`), o token `export const CREATE_OWNER_USE_CASE = Symbol('CreateOwnerUseCaseInterface')` (`..._USE_CASE` / `..._QUERY`) e os tipos de input/resultado; a classe faz `implements`. Mesmo padrão do `backoffice-ventures-api`.
- Um provider por use case em `application/providers/<verb>-<noun>.provider.ts` (`useFactory` + `inject`) com `provide: <TOKEN>` e fábrica tipada pela interface. Controllers (`@Inject(TOKEN)`) e outros use cases dependem da interface/token, **nunca da classe concreta**. Sem arquivo agregador de providers e sem `useExisting` para classe concreta.
- Sem `try/catch` genérico para virar HTTP (é do filtro). `try/catch` só com efeito colateral ou para traduzir erro específico (ex.: violação de unicidade -> `ConflictError`).
- Testado instanciando a classe com `vi.fn()` (sem `Test.createTestingModule`).

### 4.2 Interfaces (portas)

Interface + `Symbol` no mesmo arquivo em `application/interfaces/repositories/<kebab>.repository.interface.ts`:
`export const CONTENT_BRIEF_REPOSITORY = Symbol('ContentBriefRepositoryInterface')`. A leitura (read model, CQRS leve) é `<Aggregate>QueryRepositoryInterface` / `<AGGREGATE>_QUERY_REPOSITORY`. A pasta `application/ports` não existe mais.

### 4.3 Entidade de domínio

Classe `<Nome>DomainEntity` (arquivo `<nome>.domain-entity.ts`) que estende `DomainEntity` (`@/shared/domain/domain-entity`). Construtor privado; `static create(...)` valida e gera id uuid v7; `static restore(...)` reidrata do banco sem validar de novo. Mudança de estado por métodos de comportamento (`rename`, `archive`, `changeStatus`), nunca setters públicos. Value objects estendem `ValueObject` (imutável, igualdade estrutural, validam na construção).

### 4.4 Erros (ADR-008)

- `DomainError` (`@/shared/domain/errors/domain-error`) tem `kind` (`NOT_FOUND | VALIDATION | CONFLICT | FORBIDDEN | UNAUTHORIZED`), `code` estável e `message` em pt-BR. **Não conhece HTTP.**
- Cada regra de negócio ganha uma subclasse com `code` do catálogo (plan §5.6): `class ContentBriefNotFoundError extends NotFoundError { constructor() { super('CONTENT_BRIEF_NOT_FOUND', 'Pauta não encontrada'); } }`.
- Nunca lançar `HttpException` fora do `GlobalExceptionFilter`; nunca engolir erro.
- Corpo de erro: `{ statusCode, code, message, fields? }`. Status por `kind`: 404, 400, 409, 403, 401. `HttpException` do Nest ganha `code` derivado (`UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_REQUEST`, `NOT_FOUND`, `TOO_MANY_REQUESTS`). Qualquer outro erro: `500 INTERNAL_ERROR` com mensagem genérica (o detalhe só vai para o log).
- `INVALID_DATE` (value object `CalendarDate`) não é código público: o prazo da pauta recusado vira `InvalidDueDateError` (`INVALID_REQUEST`, 400) em `content-brief-data.ts`. `openContentBriefs` dos cadastros é subconsulta de leitura em `content_briefs` nos `*QueryRepository` de `estate-development` e `owner` (sem importar o módulo de pautas).
- Falha do `ValidationPipe`: `400 INVALID_REQUEST` com `fields: [{ field, message }]` (`message` em pt-BR) (tabela de tradução em `shared/infrastructure/http/validation.pipe.ts`; acrescente a constraint lá se um DTO novo usar validador ainda ausente). Mensagem customizada escrita no DTO é preservada; a padrão em inglês é traduzida.

### 4.5 Contrato HTTP (ADR-010)

- Prefixo `/api` + versão por URI: `/api/v1/...`. `/health` fica **fora** do prefixo e é neutro de versão (`@Controller({ path: 'health', version: VERSION_NEUTRAL })`). Controller novo usa a versão padrão `1`.
- Swagger em `/docs` (fora do prefixo), ligado por `SWAGGER_ENABLED` (padrão `true`, inclusive em `demo`).
- Lista paginada: `{ data, total, page, limit }`, `page` padrão 1, `limit` padrão 50, máximo 200; lista vazia é **200** com `data: []`. Use `PaginationQueryDto`, `toPageResponse` e `pageResponseDto(ItemDto)` (para o Swagger) de `shared/infrastructure/http/pagination`.
- Cadastros (`/estate-developments`, `/owners`) não paginam: array ordenado por nome, colação pt-BR, limite operacional 500.
- Datas: `dueDate` é `'YYYY-MM-DD'`; instantes em ISO-8601 UTC. JSON em camelCase; colunas em snake_case.
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) registrado por `APP_PIPE` no `AppModule`.
- A configuração HTTP (prefixo, versão, helmet, CORS, limite de corpo 100 kb, Swagger) está em `src/app.setup.ts` e é usada por `main.ts` **e** pelo bootstrap do e2e. Mude lá, não nos dois.
- `APP_GUARD` em ordem: `ThrottlerGuard` -> `AuthGuard` -> `PermissionsGuard` (ver §5.1).

### 4.6 Controllers, DTOs e presenters

- Todo endpoint: `@ApiOperation`, `@ApiResponse` para **cada** status possível, `@ApiParam`/`@ApiQuery`; controller com `@ApiTags` e `@ApiBearerAuth('bearer')` (esquema chamado exatamente `bearer`).
- DTO de request: `class-validator` + `@ApiProperty`, nome `<verb>-<noun>.request.dto.ts`, em `infrastructure/http/dtos/`. DTO de response com `@ApiProperty` (descrição, exemplo, enum).
- Presenter: função pura `to<Recurso>Response`, sem `@Injectable`. Controller nunca devolve entity/entidade de domínio.
- Permissões: toda rota de escrita com `@Permissions(...)`; leitura também (`content-brief:read`/`registry:read`/`user:read`). Só `/health`, `POST /auth/login` e `POST /auth/refresh` são `@Public()`. Rota sem `@Public`, `@Permissions` ou `@Authenticated` é negada (403) pelo `PermissionsGuard`.

### 4.7 Imports

- `@/` para tudo fora da própria pasta (`@/*` -> `src/*`); `./` só para arquivo irmão. Nunca `../../..`.
- `import type` para tipos. **Exceção (injeção do Nest):** classe injetada pelo tipo do parâmetro do construtor (sem `@Inject(TOKEN)`) precisa de `import` normal, senão o metadata de DI é apagado em tempo de execução. Por isso o Biome tem `useImportType` desligado só em `**/infrastructure/**`, `*.module.ts`, `main.ts` e `app.setup.ts`; nessas pastas escreva `import type` à mão onde for só tipo. Em `domain/` e `application/` a regra está ligada.
- Biome organiza (grupos NODE, PACKAGE, ALIAS/PATH com linha em branco). `npm run check` aplica.

### 4.8 Logs (ADR-014)

- Sempre via `LOGGER_SERVICE` (interface em `@/shared/application/interfaces/logger.service.interface`). Nunca `Logger` do Nest dentro de use case. `setLogPrefix(NomeDaClasse.name)` no construtor.
- Mensagem **em pt-BR**, curta, descrevendo o evento. Metadados mínimos: `'evt.name'` (`<module>.<action>` em inglês, snake_case), `outcome` (`success | failure | blocked | skipped`), ids de correlação (`content_brief_id`, `estate_development_id`, `owner_id`, `user_sub`), `tags`. O `request_id` é anexado automaticamente pelo formato do Winston (vem do `x-request-id`).
- **Logue decisões, não passos.** "Iniciando X" é proibido. Um evento = um log.
- 4xx -> `warn`, 5xx -> `error` (o filtro global já loga os dois; não duplique no `catch`). Erros: `...toErrorLogFields(error)` de `@/shared/utils/error-log-fields`.
- Eventos mínimos do projeto: `content_brief.created`, `content_brief.updated`, `content_brief.status_changed`, `content_brief.deleted`, `content_brief.version_conflict`, `estate_development.created|renamed|archived|reactivated` (idem `owner.*`), `auth.guard.rejected`, `auth.login`, `auth.account_locked`, `auth.refresh`, `auth.refresh_token_reuse_detected`, `auth.logout`, `auth.password_changed`, `user.created|updated|deactivated|reactivated|password_reset`, `user.bootstrap_admin`, `http.request.server_error`.
- **Nunca logar** senha, hash de senha, access ou refresh token, header `Authorization`, título ou descrição de pauta, e-mail completo (única exceção: o bootstrap do admin registra o e-mail configurado, nunca a senha). Query string não vai para o log (o filtro registra só o caminho).
- Todo `Promise` precisa de `await`, `.catch()` ou `void` explícito (o Biome não tem `no-floating-promises`; o revisor confere).

### 4.9 Persistência (ADR-004)

Postgres 18, TypeORM 0.3 com `synchronize: false`. Migrations em `src/database/migrations/<epochms>-PascalName.ts`, rodadas por comando (`npm run migration:run`), **nunca no boot**, só no stream da API e em sequência; nunca editar migration já aplicada (única exceção, feita uma vez: ADR-015, ver seção 8). As tabelas `users` e `refresh_tokens` (ADR-016) vieram em migrations novas. Ids uuid v7 gerados na aplicação (lib `uuid`). Colunas de auditoria em toda tabela de negócio: `created_at`, `created_by`, `created_by_name`, `updated_at`, `updated_by`, `updated_by_name`, mais `version` (concorrência otimista, ADR-006). Seeds idempotentes em `src/database/seeds/` (`npm run seed:dev`). SQL só por QueryBuilder/parâmetros: valor do usuário nunca é interpolado (os predicados da listagem são montados por funções puras em `content-brief-filter.sql.ts`). Carga e medição de desempenho: `scripts/` (`npm run load:seed|load:clean|load:measure`, ver README).

- `DatabaseModule` (`src/database/`) usa `autoLoadEntities` (cada módulo registra a entity com `TypeOrmModule.forFeature`) e `SnakeNamingStrategy` (`shared/infrastructure/persistence`): propriedade camelCase vira coluna snake_case. Entity nova: `<Nome>Entity` com `@Entity('tabela')` em `infrastructure/persistence/entities/<nome>.entity.ts` (o sufixo `.entity.ts` é o glob do `typeorm.config.ts`), com `@Column(() => AuditColumns, { prefix: false }) audit` e `applyAudit(entity, actor, clock.now())` antes de gravar. Violação de unicidade: `isUniqueViolation(error, 'nome_do_indice')`.
- `src/database/typeorm.config.ts` é a configuração única do banco: `buildDataSourceOptions()` (alimenta o `DatabaseModule`) + `DataSource` exportado por padrão (CLI e seed). Lê `DATABASE_HOST|PORT|USER|PASS|NAME|SSL` (mais `DATABASE_SSL_REJECT_UNAUTHORIZED` e `DATABASE_POOL_MAX`); os padrões locais ficam em `database-defaults.ts`.
- `migration:run|revert|show` rodam o `typeorm.config.ts` direto do TS (type stripping do Node): ele e as migrations ficam autocontidos (sem `@/`, sem decorators, `import type` para tipos do TypeORM; import relativo só com extensão `.ts`, que o `rewriteRelativeImportExtensions` do tsconfig reescreve no build) e as migrations escrevem SQL explícito. Neste modo as entities não são carregadas (têm decorators). `migration:generate`, `migration:run:prod` e `seed:dev` usam `dist/`, onde o glob `*.entity.js` carrega as entities. Migration nova: arquivo `<epochms>-PascalName.ts`, classe `PascalName<epochms>` (o TypeORM exige o timestamp no fim do nome), `up` e `down` testados.
- Relógio: casos de uso recebem `ClockInterface` (`CLOCK`, `shared/application/interfaces/clock.interface.ts`) e nunca chamam `new Date()` para "hoje". Datas de calendário são `CalendarDate`. Testes: `FixedClock`.
- e2e: `bootstrapApp({ env, providers, today })` devolve `{ client, dataSource, clock, close }`; chame `cleanDatabase(e2e.dataSource)` no `beforeEach` (descobre as tabelas por `information_schema`, preserva `migrations`).

## 5. Configuração

`src/config/env.validation.ts`: classe `EnvironmentVariables` + `validate()` no `ConfigModule.forRoot({ isGlobal: true, validate })`. Leia com `ConfigService<Env, true>` e `{ infer: true }`. A config recusa subir com valor inválido (`APP_TIMEZONE` fora da lista IANA, `STAGE=demo` sem `CORS_ORIGINS`, `STAGE` diferente de `local` sem `DATABASE_HOST|PORT|USER|PASS|NAME|SSL`...). `DATABASE_SSL` é `true` para Neon/produção e `false` no local; aceita só `true`/`false`. Variável nova entra na classe, no `.env.example` e na tabela do README. Booleans usam parsing explícito (`'false'` não pode virar `true`).

### 5.1 Autenticação e autorização (módulos `auth` e `user`, ADR-016)

Autenticação própria: e-mail + senha (argon2id), access token JWT HS256 e refresh token opaco com rotação. Documento de contrato (rotas, JSON, erros, fluxo de tokens): `docs/auth.md`.

- **`auth`** (`src/modules/auth`): `domain/{enums/{role,permission},services/role-permissions,errors/auth.errors}`, `application/{interfaces/token.service.interface,types/{authenticated-user,auth-session},use-cases/{login,refresh-token,logout,change-password,common/session-issuer},queries/get-user-info,providers}`, `infrastructure/{services/token.service,http/{guards,decorators,controllers,dtos,presenters,types}}`. **`user`** (`src/modules/user`): agregado `UserDomainEntity` (+ `RefreshTokenDomainEntity`), `UserRepositoryInterface`/`UserQueryRepositoryInterface`/`RefreshTokenRepositoryInterface`, use cases `create-user`, `update-user`, `deactivate-user`, `reactivate-user`, `reset-user-password`, `bootstrap-admin`, queries `list-users`/`find-user-by-id`, `AdminBootstrapService`, controller `/users`. Tabelas `users` e `refresh_tokens` são do `user`.
- **Papéis** (um por usuário): `admin`, `content-brief-editor`, `content-brief-viewer`. O mapa papel -> permissão (`ROLE_PERMISSIONS` em `auth/domain/services/role-permissions.ts`, travado por spec) é a **única** fonte; use `permissionsOfRole(role)`. `admin` tem todas; editor e viewer não têm `user:*`. Permissões: `content-brief:read|write|delete`, `registry:read|write`, `user:read|write`. **O token só carrega `role`**: a decisão de acesso é derivada do papel no servidor; o front nunca reimplementa o mapa.
- Decorators de rota (`infrastructure/http/decorators/`): `@Public()` (só `/health`, login e refresh), `@Authenticated()` (só exige login; usado em `/auth/user-info`, logout e troca de senha), `@Permissions(...)` (exige todas), `@LoginThrottle()` (limite por IP mais baixo, `LOGIN_THROTTLE_LIMIT_PER_MINUTE`, nomeado `login` no `ThrottlerModule`). Sem nenhum dos três primeiros, o `PermissionsGuard` nega com 403 (seguro por padrão, ADR-013). `@CurrentUser()` entrega `AuthenticatedUser { id, name, email, role, permissions }`; use `toActor(user)` para passar `Actor { id, name }` ao use case (nunca o request). `created_by`/`updated_by` guardam o uuid do usuário.
- `AuthGuard`: `@Public()` libera; senão Bearer -> `TOKEN_SERVICE.verifyAccessToken` (HS256 fixado, `iss`, `aud`, `exp`; sem ir ao banco). Toda recusa vira `401 UNAUTHENTICATED` com log `auth.guard.rejected` (`reason`, `request_id`). **Consequência documentada:** desativar um usuário ou trocar o papel só vale nos tokens novos, no máximo `JWT_ACCESS_TTL` (15 min) depois; login e refresh negam na hora. **Nunca logar senha, hash, token nem o header `Authorization`.**
- Refresh: 256 bits aleatórios (base64url), só o hash SHA-256 em `refresh_tokens`; cada uso revoga o token e emite outro na mesma `family_id` (a rotação é um `UPDATE ... WHERE revoked_at IS NULL` atômico); apresentar um token já revogado revoga a família inteira. Trocar/redefinir senha e desativar revogam todos os refresh tokens do usuário.
- Login (`LoginUseCase`): `INVALID_CREDENTIALS` único para e-mail inexistente e senha errada, com `PasswordHasherInterface.burnVerification` (equalização de tempo); bloqueio por conta (`LOGIN_MAX_ATTEMPTS`/`LOGIN_LOCK_MINUTES`) pelo `UserRepositoryInterface.updateLoginState`, atômico (linha travada) e **sem** mexer em `version` nem na auditoria. Usuário desativado só descobre depois de provar a senha.
- Regras de administração (`user/domain/services/user-admin-rules.ts`): não desativar nem rebaixar a si mesmo (`CANNOT_MODIFY_SELF`); não remover o último admin ativo (`LAST_ADMIN`; o `UserRepository.save` repete a checagem numa transação com advisory lock, contra corrida); e-mail único em `lower(email)` (`EMAIL_ALREADY_REGISTERED`); senha de 10 a 128 caracteres (`WEAK_PASSWORD`). Senha provisória gerada (`PasswordGeneratorInterface`, CSPRNG) é devolvida **uma única vez** e nunca registrada.
- Config: `JWT_SECRET` (mínimo 32; obrigatório fora de `local`/`e2e`, onde existe um padrão de desenvolvimento que fora deles é recusado), `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `LOGIN_THROTTLE_LIMIT_PER_MINUTE`, `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` (as duas ou nenhuma).
- Bootstrap e seed: `AdminBootstrapService` cria o admin inicial (`mustChangePassword = true`) só se **não houver nenhum usuário** e as duas variáveis existirem; idempotente; sem variáveis e sem usuários, só avisa. `npm run seed:dev` (só `STAGE` `local`/`demo`) cria `dev.admin`, `dev.editor`, `dev.leitor` (`*@pauta.local`) com a **senha só de desenvolvimento** `dev-only-pauta-2026` (pública, `mustChangePassword = false`).
- e2e: use `TOKENS.admin|editor|viewer|unknownRole` (`e2e/src/core/tokens.ts`, preenchidos pelo `bootstrapApp` com tokens do `TokenService` real; o `sub` não existe em `users`) em `client.get(url, { token })`, `forgeAccessToken(...)` para tokens expirados/adulterados e `createUser`/`loginAs` (`e2e/src/core/users.ts`) para fluxos com usuário real. `e2e.clock.advanceMinutes(n)` destrava contas por tempo.

## 6. Testes

- `.spec.ts` ao lado de cada entidade, VO, serviço de domínio, use case, query, guard e filtro. Controller, mapper, presenter e repositório são cobertos pelo e2e (sem spec unitário próprio).
- Vitest + `unplugin-swc` (`oxc: false`, `globals: true`, alias `@`). **Não** "conserte" metadata de decorators com `@Inject()` em todo lugar: use o swc.
- Spec que usa `class-transformer` com `@Type`/conversão implícita precisa de `reflect-metadata` carregado (importe `reflect-metadata` no arquivo testado quando ele não importa `@nestjs/*`).
- e2e: `e2e/specs/<modulo>/*.e2e-spec.ts` cobrindo cada papel, via `bootstrapApp()` (`e2e/src/runner/app-bootstrap.ts`, sobe o `AppModule` real com `listen(0)`) e `HttpClient` (`e2e/src/core/http-client.ts`, wrapper de `fetch`). `fileParallelism: false`. Postgres real via Testcontainers e auth real e hermética (JWT HS256 com o segredo de desenvolvimento e argon2id; ADR-009, ADR-016). O `AppModule` é importado dentro de `bootstrapApp` (import tardio) porque o `ConfigModule` valida o ambiente ao carregá-lo.
- Cobertura: relatório, sem `thresholds`.

## 7. Documentação

README atualizado a cada endpoint, env, regra ou código de erro novo. Swagger documenta o contrato técnico; o README, o propósito e como as peças se conectam. Catálogo de `code` no README e no plan §5.6.

## 8. Padrão de nomes (ADR-015)

Vale acima de qualquer outro documento (`.docs/pauta-mkt/15-padrao-de-nomes.md`); o código segue as mesmas convenções dos repositórios de referência do dono.

- **Todo identificador é em inglês**: pastas, arquivos, classes, interfaces, tipos, funções, métodos (inclusive `private`), variáveis, enums e seus valores, rotas, campos de JSON, query params, tabelas, colunas, tipos enum e índices do Postgres, `code` de erro, `evt.name` de log, papéis e permissões. **Continuam em pt-BR**: textos ao usuário, `message` das respostas e dos logs, comentários/JSDoc, descrições de teste (`it('...')`) e documentação. Não mudam: `pauta-mkt`, `pauta-mkt-api`, `pauta-mkt-ui`, `pauta-mkt-dev-cli`, realm `bora`, banco `pauta`, `/api/v1`, `/health`, `/auth/user-info`, `/docs`, variáveis de ambiente.
- **Glossário**: Responsável = `Owner` (`owners`, `owner_id`), Empreendimento = `EstateDevelopment` (`estate-development`, `estate_development`), Pauta = `ContentBrief` (`content-brief`, `content_brief`), Cadastro genérico = `Registry` (`RegistryName`, permissões `registry:*`), `Actor`/`Audit`, `Clock`/`CalendarDate`, prazo = `dueDate` (`DueStatus`, `daysUntilDue`, `classifyDueDate`).
- **Interfaces de repositório**: `application/interfaces/repositories/<kebab>.repository.interface.ts` com `<Aggregate>RepositoryInterface` e `export const <AGGREGATE>_REPOSITORY = Symbol('<Aggregate>RepositoryInterface')`; a leitura é `<Aggregate>QueryRepositoryInterface` / `<AGGREGATE>_QUERY_REPOSITORY` e devolve `<Aggregate>ReadModel`. Interfaces compartilhadas em `src/shared/application/interfaces/*.interface.ts` (`LoggerServiceInterface`/`LOGGER_SERVICE`, `ClockInterface`/`CLOCK`, `PasswordHasherInterface`/`PASSWORD_HASHER`).
- **Implementações**: `infrastructure/persistence/repositories/<kebab>/<kebab>.repository.ts` (`<Aggregate>Repository`) e `<kebab>-query.repository.ts` (`<Aggregate>QueryRepository`), sem sufixo `typeorm`.
- **Entity x DomainEntity**: `Entity` é o objeto do ORM (`OwnerEntity`, `infrastructure/persistence/entities/owner.entity.ts`); `DomainEntity` é a entidade de domínio (`OwnerDomainEntity`, `domain/entities/owner.domain-entity.ts`, base `DomainEntity`). Value objects e errors não mudam. `ReadModel` (leitura) é outra coisa e continua com esse nome.
- **Vocabulário de método** (mesmo das referências): `create`, `update`, `save`, `findAll`, `findOneById`, `findById`, `findByNormalizedName`, `findByIds`, `remove`, `softDelete`, `reactivate`, `exists`. Nos repositórios de escrita `findById`/`save`/`softDelete`; nos de leitura (`*QueryRepository`) `findAll`/`findOneById`. Concorrência otimista: `save(entity, expectedVersion)` ou `update(entity, expectedVersion)` lançando `<Aggregate>VersionOutdatedError`. Métodos `private` também em inglês e descritivos (`updateWithVersionCheck`, `buildNameDuplicatedError`, `resolveUpdateFailure`), nunca `atualizar`/`duplicado`. Entidades: `create`/`restore`, `rename`, `archive`, `reactivate`, `changeStatus`, `update`, `delete`. Use cases e queries expõem `execute(...)`.
- **Use cases**: pasta e arquivo `<verb>-<noun>/<verb>-<noun>.use-case.ts`, classe `<Verb><Noun>UseCase`, interface `<verb>-<noun>.use-case.interface.ts` (`<Verb><Noun>UseCaseInterface`, token `<VERB>_<NOUN>_USE_CASE`); consultas `list-owners/list-owners.query.ts` → `ListOwnersQuery`, `list-owners.query.interface.ts` (`ListOwnersQueryInterface`, `LIST_OWNERS_QUERY`); provider `<verb>-<noun>.provider.ts`.
- **Contrato HTTP**: `/estate-developments`, `/owners` (`POST /:id/archive`, `/:id/reactivate`), `/content-briefs` (+ `/summary`); JSON camelCase; erro `{ statusCode, code, message, fields?: [{ field, message }] }`; `GET /auth/user-info` → `{ id, email, name, role, permissions }`; `/auth/{login,refresh,logout,change-password}` e `/users` (ADR-016, ver `docs/auth.md`); valores de enum em inglês (`TODO|IN_PROGRESS|IN_REVIEW|DONE`, `CHASE|DEVELOP|PAYMENT|CREATE|FOLLOW_UP|ANALYZE`, `INSTAGRAM|EMAIL|BLOG|ADS|VIDEO|WEBSITE|REPORT|OTHER`, `DueStatus` em kebab-case: `overdue|today|next-7-days|later|no-due-date|completed`).
- **Migrations reescritas no lugar uma única vez**: `CreateCadastros` e `CreatePautas` viraram `CreateEstateDevelopmentsAndOwners` e `CreateContentBriefs` (tabelas, colunas, enums e índices em inglês) porque a POC não tinha dado real nem migration aplicada fora da máquina de desenvolvimento. **A partir daqui, migration aplicada não se edita**: toda mudança de esquema é uma migration nova.
- **Conferência**: `grep -rniE "[áàâãéêíóôõúç]" src e2e` só pode achar comentário, texto de usuário/log/erro e descrição de teste; `find src e2e -iname '*pauta*' -o -iname '*empreend*' -o -iname '*responsavel*' -o -iname '*cadastro*'` não acha nada (o nome do projeto `pauta-mkt` é a exceção).
