# Autenticação e administração de usuários (ADR-016)

Contrato da autenticação própria da API e da administração de usuários. **A UI é construída em cima deste documento.** Base de todas as rotas: `/api/v1`. Corpos e respostas em JSON, campos em `camelCase`, datas em ISO-8601 UTC. Swagger em `/docs`.

Exemplos que mostram valores de segredo (senhas, tokens) usam placeholders. A senha `dev-only-pauta-2026` dos usuários `dev.*@pauta.local` é a **senha só de desenvolvimento** do `npm run seed:dev`: pública, nunca use fora de uma máquina de desenvolvimento.

## 1. Visão geral

- Login por **e-mail e senha** (`POST /auth/login`). Não há SSO, MFA nem recuperação de senha por e-mail (ficaram fora, ADR-016): quem esqueceu a senha pede a um administrador a redefinição (`POST /users/:id/reset-password`).
- A API devolve um **access token** (JWT HS256, 15 min) e um **refresh token** (opaco, 7 dias, uso único).
- O front envia o access token em `Authorization: Bearer <accessToken>` em toda chamada, exceto `GET /health`, `POST /auth/login` e `POST /auth/refresh` (públicos).
- Cada usuário tem **um papel**: `admin`, `content-brief-editor` ou `content-brief-viewer`. As **permissões** são derivadas do papel **no servidor** e devolvidas no login e em `GET /auth/user-info`. O front usa a lista `permissions` para mostrar ou esconder telas e botões e **nunca reimplementa o mapa papel -> permissão**.

### Papéis e permissões

| Permissão                                              | `admin` | `content-brief-editor` | `content-brief-viewer` |
| ------------------------------------------------------ | :-----: | :--------------------: | :--------------------: |
| `content-brief:read`                                   |   sim   |          sim           |          sim           |
| `content-brief:write` (criar, editar, mudar status)    |   sim   |          sim           |                        |
| `content-brief:delete`                                 |   sim   |          sim           |                        |
| `registry:read`                                        |   sim   |          sim           |          sim           |
| `registry:write` (criar, renomear, arquivar, reativar) |   sim   |          sim           |                        |
| `user:read`                                            |   sim   |                        |                        |
| `user:write`                                           |   sim   |                        |                        |

`permissions` é sempre devolvida **nesta ordem** (ordem do enum): `content-brief:read`, `content-brief:write`, `content-brief:delete`, `registry:read`, `registry:write`, `user:read`, `user:write`.

## 2. Tabela de endpoints

| Método e rota                    | Autenticação                      | Corpo                                | Sucesso                                      |
| -------------------------------- | --------------------------------- | ------------------------------------ | -------------------------------------------- |
| `POST /auth/login`               | pública (limite por IP)           | `{ email, password }`                | `200` sessão (seção 3.1)                     |
| `POST /auth/refresh`             | pública                           | `{ refreshToken }`                   | `200` sessão nova (seção 3.2)                |
| `POST /auth/logout`              | access token (\*)                 | `{ refreshToken }`                   | `204` sem corpo                              |
| `POST /auth/change-password`     | access token (\*) (limite por IP) | `{ currentPassword, newPassword }`   | `200` **sessão nova** (seção 3.4)            |
| `GET /auth/user-info`            | access token (\*)                 | -                                    | `200 { id, email, name, role, permissions }` |
| `GET /users`                     | `user:read`                       | query `q`, `status`, `page`, `limit` | `200` página de usuários                     |
| `GET /users/:id`                 | `user:read`                       | -                                    | `200` usuário                                |
| `POST /users`                    | `user:write`                      | `{ name, email, role, password? }`   | `201 { user, temporaryPassword }`            |
| `PATCH /users/:id`               | `user:write`                      | `{ name?, role?, version }`          | `200` usuário                                |
| `POST /users/:id/deactivate`     | `user:write`                      | -                                    | `200` usuário                                |
| `POST /users/:id/reactivate`     | `user:write`                      | -                                    | `200` usuário                                |
| `POST /users/:id/reset-password` | `user:write`                      | -                                    | `200 { user, temporaryPassword }`            |

(\*) Rotas liberadas também para o token de **senha provisória pendente** (`mustChangePassword: true`): são as **únicas**. Todas as demais rotas protegidas respondem `403 PASSWORD_CHANGE_REQUIRED` a esse token (seção 3.4).

Respostas que carregam segredo (`login`, `refresh`, `change-password`, criação de usuário, `reset-password`) levam `Cache-Control: no-store`.

## 3. Autenticação

### 3.1 `POST /auth/login`

Requisição:

```json
{ "email": "dev.editor@pauta.local", "password": "dev-only-pauta-2026" }
```

O e-mail não diferencia caixa e espaços nas pontas são ignorados. `password` tem no máximo 128 caracteres.

Resposta `200`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi4uLn0.assinatura",
  "refreshToken": "q1W2e3R4t5Y6u7I8o9P0aSdFgHjKlZxCvBnM1q2w3e4",
  "expiresIn": 900,
  "mustChangePassword": false,
  "user": {
    "id": "0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10",
    "email": "dev.editor@pauta.local",
    "name": "Dev Editor",
    "role": "content-brief-editor",
    "permissions": [
      "content-brief:read",
      "content-brief:write",
      "content-brief:delete",
      "registry:read",
      "registry:write"
    ]
  }
}
```

| Campo                | Significado                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken`        | JWT para o cabeçalho `Authorization: Bearer`                                                                                                                                                                                                                                            |
| `refreshToken`       | 43 caracteres base64url. Vale **uma única vez**: guarde só o mais recente                                                                                                                                                                                                               |
| `expiresIn`          | Validade do access token **em segundos** (padrão 900)                                                                                                                                                                                                                                   |
| `mustChangePassword` | `true` quando a senha é provisória (usuário criado ou redefinido por um administrador, ou admin inicial). **A API impõe a troca**: o access token vem restrito (claim `mcp`) e só alcança `change-password`, `logout` e `user-info`; o front leva o usuário à tela de troca (seção 3.4) |
| `user`               | Identidade e permissões                                                                                                                                                                                                                                                                 |

Erros do login:

| Status | `code`                | Quando                                                                                                        |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| 400    | `INVALID_REQUEST`     | Corpo fora do contrato (falta campo, tipo errado, campo extra, senha com mais de 128 caracteres)              |
| 401    | `INVALID_CREDENTIALS` | E-mail inexistente **ou** senha errada (mesma resposta e mesmo tempo, de propósito). Inclui e-mail malformado |
| 403    | `ACCOUNT_LOCKED`      | Conta bloqueada por excesso de tentativas; a `message` informa os minutos restantes                           |
| 403    | `USER_DEACTIVATED`    | Usuário desativado. Só aparece depois de a senha estar correta                                                |
| 429    | `TOO_MANY_REQUESTS`   | Limite de requisições por IP (mais baixo no login: padrão 10 por minuto)                                      |

### 3.2 `POST /auth/refresh`

Requisição: `{ "refreshToken": "q1W2e3R4t5Y6u7I8o9P0aSdFgHjKlZxCvBnM1q2w3e4" }`. Resposta `200`: **exatamente o formato do login** (novo `accessToken`, **novo `refreshToken`**, `expiresIn`, `mustChangePassword`, `user` com o papel atual do banco).

Erros:

| Status | `code`                  | Quando                                                                                               |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| 400    | `INVALID_REQUEST`       | Corpo fora do contrato                                                                               |
| 401    | `INVALID_REFRESH_TOKEN` | Token desconhecido, expirado (7 dias), revogado (logout, troca de senha, desativação) ou reutilizado |
| 403    | `USER_DEACTIVATED`      | Usuário desativado (a família de sessões é revogada)                                                 |

### 3.3 `POST /auth/logout`

Exige o access token. Corpo `{ "refreshToken": "..." }`. Responde `204` e revoga a **família** do refresh token (as renovações dessa sessão). É **idempotente**: token desconhecido, já revogado ou de outro usuário também dá `204` e não faz nada. Outras sessões (outros dispositivos) do mesmo usuário continuam valendo. Se o access token já expirou, renove antes (`/auth/refresh`) ou simplesmente descarte os tokens no cliente.

### 3.4 `POST /auth/change-password` e a senha provisória

Exige o access token (inclusive o **restrito** de quem está com senha provisória). Requisição:

```json
{
  "currentPassword": "senha-provisoria-recebida",
  "newPassword": "minha-senha-nova-forte"
}
```

Resposta `200`: **uma sessão nova, no mesmo formato do login** (`accessToken`, `refreshToken`, `expiresIn`, `mustChangePassword: false`, `user`), com `Cache-Control: no-store`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi4uLn0.assinatura",
  "refreshToken": "q1W2e3R4t5Y6u7I8o9P0aSdFgHjKlZxCvBnM1q2w3e4",
  "expiresIn": 900,
  "mustChangePassword": false,
  "user": {
    "id": "0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10",
    "email": "maria@bora.com.br",
    "name": "Maria Souza",
    "role": "content-brief-editor",
    "permissions": [
      "content-brief:read",
      "content-brief:write",
      "content-brief:delete",
      "registry:read",
      "registry:write"
    ]
  }
}
```

Efeitos: grava a senha nova, limpa `mustChangePassword`, destrava a conta e **revoga todos os refresh tokens do usuário, inclusive o da sessão atual** (por isso a resposta traz uma sessão nova, de família nova, e o cliente continua logado). O front **substitui os dois tokens guardados pelos da resposta** (o refresh token antigo já não vale) e segue para o app, sem passar de novo pelo login. As demais sessões do usuário (outros dispositivos) caem e precisam entrar de novo.

| Status | `code`                     | Quando                                                                                     |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| 400    | `INVALID_REQUEST`          | Corpo fora do contrato                                                                     |
| 400    | `INVALID_CURRENT_PASSWORD` | A senha atual não confere (400 de propósito, para o front não tratar como sessão expirada) |
| 400    | `WEAK_PASSWORD`            | Nova senha fora de 10 a 128 caracteres, ou igual à atual                                   |
| 401    | `UNAUTHENTICATED`          | Access token ausente, inválido ou expirado                                                 |
| 403    | `USER_DEACTIVATED`         | Usuário desativado (com access token ainda válido)                                         |
| 429    | `TOO_MANY_REQUESTS`        | Limite por IP (o mesmo limite baixo do login)                                              |

#### Fluxo da senha provisória (`PASSWORD_CHANGE_REQUIRED`)

A senha provisória nasce quando um administrador cria o usuário (`POST /users`) ou o redefine (`POST /users/:id/reset-password`), e no admin inicial do bootstrap. **A API impede o uso do sistema até a troca**, não só o front:

1. `POST /auth/login` (ou `/auth/refresh`) devolve `mustChangePassword: true` e um access token com a claim booleana **`mcp`** (must change password). A claim só existe quando verdadeira; o front pode usá-la, mas quem decide é a API.
2. Com esse token, **toda rota protegida** responde `403` com `{ "statusCode": 403, "code": "PASSWORD_CHANGE_REQUIRED", "message": "Troque a senha provisória para continuar." }`, **exceto** `POST /auth/change-password`, `POST /auth/logout` e `GET /auth/user-info` (que continuam funcionando, por exemplo para exibir o nome na tela de troca ou sair).
3. O front, ao ver `mustChangePassword: true` no login/refresh **ou** um `403 PASSWORD_CHANGE_REQUIRED` em qualquer chamada, leva o usuário à tela de troca de senha e **não** o trata como "sem permissão" nem como sessão expirada.
4. `POST /auth/change-password` devolve a sessão nova (acima). Com o token novo (sem `mcp`) o usuário acessa tudo normalmente.
5. **Um token antigo com `mcp` continua restrito** depois da troca (a decisão vem da claim, sem ir ao banco) até expirar, no máximo `JWT_ACCESS_TTL`; os refresh tokens antigos foram revogados. O front só deve usar a sessão devolvida pela troca.
6. Um `refresh` de sessão ainda pendente devolve de novo `mustChangePassword: true` e token restrito.

### 3.5 `GET /auth/user-info`

Resposta `200`:

```json
{
  "id": "0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10",
  "email": "dev.admin@pauta.local",
  "name": "Dev Admin",
  "role": "admin",
  "permissions": [
    "content-brief:read",
    "content-brief:write",
    "content-brief:delete",
    "registry:read",
    "registry:write",
    "user:read",
    "user:write"
  ]
}
```

Lê só as claims do access token (sem ir ao banco): reflete nome e papel de **quando o token foi emitido**. Funciona também com o token de senha provisória pendente. Para ver o estado atual, renove a sessão. Os campos `sub` e `roles` do contrato antigo **não existem mais**.

## 4. Fluxo de tokens

```
login ──► accessToken (15 min) + refreshToken R1 (família F)
            │
            │  chamadas com  Authorization: Bearer <accessToken>
            │
            ▼  access token perto de expirar, ou 401 UNAUTHENTICATED
refresh(R1) ──► accessToken novo + refreshToken R2 (R1 revogado, mesma família F)
refresh(R2) ──► accessToken novo + refreshToken R3 (R2 revogado)
            ...
refresh(R1) de novo  ──► 401 INVALID_REFRESH_TOKEN e a família F inteira é revogada (reuso = suspeita de roubo)
logout(R3)  ──► 204; a família F é revogada
```

Regras que a UI deve seguir:

1. **Guarde só o refresh token mais recente.** Cada resposta de `refresh` traz um novo; gravar o novo antes de usar o access token novo.
2. **Serialize as renovações.** Duas chamadas simultâneas de `refresh` com o mesmo token são tratadas como reuso: uma vence e a outra recebe `401 INVALID_REFRESH_TOKEN`, **e a família inteira é revogada** (o usuário precisa entrar de novo). Use um único "voo" de refresh no cliente (promessa compartilhada) e reaproveite o resultado nas chamadas que esperam.
3. Ao receber `401 UNAUTHENTICATED` numa rota de negócio: tente **uma** renovação; se der certo, repita a chamada; se der `401 INVALID_REFRESH_TOKEN` ou `403 USER_DEACTIVATED`, descarte os tokens e vá ao login.
4. Os 401 de `login` (`INVALID_CREDENTIALS`) não disparam renovação.
5. **Access token:** JWT HS256, TTL `JWT_ACCESS_TTL` (padrão 15 min). Claims: `sub` (uuid do usuário), `email`, `name`, `role`, `mcp` (booleana, **só presente quando `true`**: senha provisória pendente, ver seção 3.4), `iss` (`JWT_ISSUER`, padrão `pauta-mkt-api`), `aud` (`JWT_AUDIENCE`, padrão `pauta-mkt`), `iat`, `exp`. **O token não carrega permissões**: o servidor as deriva do `role`. O front pode ler as claims para exibir nome e e-mail, mas não deve confiar nelas para autorizar (quem autoriza é a API).
6. **Refresh token:** opaco (256 bits aleatórios, base64url), gravado na API só como hash SHA-256. Vale `JWT_REFRESH_TTL` (padrão 7 dias) **desde a emissão de cada um** (a renovação reinicia o prazo) e **uma única vez**.
7. **Janela de efeito de desativar/rebaixar usuário.** O guard valida o JWT localmente e não consulta o banco a cada requisição. Por isso **desativar um usuário ou mudar o papel dele vale nos tokens novos, no máximo até o access token expirar (15 min)**. Ao desativar, a API revoga os refresh tokens e nega login e refresh na hora; o access token já emitido continua aceito até expirar. Mudança de papel aparece no próximo `refresh`/login.
8. Trocar ou redefinir a senha **revoga todos os refresh tokens** do usuário (todas as sessões). Na troca pelo próprio usuário a resposta já traz a sessão nova (seção 3.4); na redefinição pelo administrador o usuário entra de novo com a senha provisória.
9. Com `mustChangePassword: true` (claim `mcp`), as rotas de negócio respondem `403 PASSWORD_CHANGE_REQUIRED` até a troca de senha (seção 3.4).

## 5. Administração de usuários

Todas as rotas exigem `user:read` (leitura) ou `user:write` (escrita): só o `admin`. Editor e leitor recebem `403 FORBIDDEN`. Nenhuma resposta traz hash de senha nem token.

### 5.1 Recurso `User`

```json
{
  "id": "0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10",
  "name": "Maria Souza",
  "email": "maria.souza@bora.com.br",
  "role": "content-brief-editor",
  "status": "ACTIVE",
  "mustChangePassword": false,
  "lockedUntil": null,
  "lastLoginAt": "2026-11-14T12:00:00.000Z",
  "version": 3,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "createdBy": {
    "id": "0192f6a0-0000-7000-8000-000000000001",
    "name": "Administrador"
  },
  "updatedAt": "2026-11-14T12:00:00.000Z",
  "updatedBy": {
    "id": "0192f6a0-0000-7000-8000-000000000001",
    "name": "Administrador"
  }
}
```

| Campo                   | Observação                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `role`                  | `admin`, `content-brief-editor` ou `content-brief-viewer`                                                                                  |
| `status`                | `ACTIVE` ou `DEACTIVATED`                                                                                                                  |
| `mustChangePassword`    | `true` enquanto o usuário usa senha provisória                                                                                             |
| `lockedUntil`           | Fim do bloqueio por tentativas. A conta **só está bloqueada se a data é futura**; passada, já destravou (compare com o relógio do cliente) |
| `lastLoginAt`           | Último login com sucesso, ou `null`                                                                                                        |
| `version`               | Concorrência otimista: envie de volta em `PATCH`. Login e falhas de login **não** mudam a `version`                                        |
| `createdBy`/`updatedBy` | `id` é o uuid de quem agiu (ou `bootstrap`/`seed`); `name` é um snapshot                                                                   |

### 5.2 `GET /users`

Query (todas opcionais): `q` (1 a 100 caracteres; busca em nome **ou** e-mail, sem diferenciar caixa nem acento, "contém"), `status` (`ACTIVE` ou `DEACTIVATED`), `page` (padrão 1), `limit` (padrão 50, máximo 200). Ordenado por nome (colação pt-BR). Resposta `200`:

```json
{
  "data": [{ "...": "recurso User" }],
  "total": 12,
  "page": 1,
  "limit": 50
}
```

Lista vazia é `200` com `data: []`. Parâmetro inválido: `400 INVALID_REQUEST` com `fields`.

### 5.3 `GET /users/:id`

`200` com o recurso `User`; `404 USER_NOT_FOUND` se não existe; `400 INVALID_REQUEST` se o id não é um UUID.

### 5.4 `POST /users`

Requisição:

```json
{
  "name": "Maria Souza",
  "email": "maria.souza@bora.com.br",
  "role": "content-brief-editor"
}
```

`password` é opcional (10 a 128 caracteres). **Sem `password`**, a API gera uma senha provisória forte (16 caracteres) e a devolve **uma única vez**. Resposta `201`:

```json
{
  "user": { "...": "recurso User, com mustChangePassword: true" },
  "temporaryPassword": "Vq7#kT9m-Rw2xPz4"
}
```

- `temporaryPassword` **nunca mais é recuperável**: a tela deve exibi-la uma vez (com botão de copiar) e avisar que não será mostrada de novo. Repasse por canal seguro.
- Com `password` informado, `temporaryPassword` vem `null` (a API não repete o que o administrador digitou).
- Nos dois casos o usuário nasce com `mustChangePassword: true` e é obrigado a trocar a senha no primeiro login.
- O e-mail é gravado em minúsculas e é único, também entre usuários desativados.

| Status | `code`                     | Quando                                                                   |
| ------ | -------------------------- | ------------------------------------------------------------------------ |
| 400    | `INVALID_REQUEST`          | Corpo fora do contrato (papel desconhecido, campo extra, falta de campo) |
| 400    | `INVALID_USER_NAME`        | Nome vazio (após normalizar espaços) ou com mais de 120 caracteres       |
| 400    | `INVALID_EMAIL`            | E-mail fora do formato ou com mais de 254 caracteres                     |
| 400    | `WEAK_PASSWORD`            | `password` informado fora de 10 a 128 caracteres                         |
| 409    | `EMAIL_ALREADY_REGISTERED` | E-mail já cadastrado (qualquer caixa), ativo ou desativado               |

### 5.5 `PATCH /users/:id`

```json
{ "name": "Maria Souza Lima", "role": "content-brief-viewer", "version": 3 }
```

`name` e `role` são opcionais, mas ao menos um é obrigatório; `version` é obrigatória. O e-mail não muda. Resposta `200` com o `User` (a `version` sobe). Erros: `400 INVALID_REQUEST` (nenhum campo, papel desconhecido, campo extra), `400 INVALID_USER_NAME`, `404 USER_NOT_FOUND`, `409 USER_VERSION_OUTDATED` (recarregue e tente de novo), `409 CANNOT_MODIFY_SELF` (mudar o **próprio papel**; mudar o próprio nome é permitido), `409 LAST_ADMIN` (rebaixar o último admin ativo).

### 5.6 `POST /users/:id/deactivate` e `POST /users/:id/reactivate`

Sem corpo. Resposta `200` com o `User`. Ambos são **idempotentes** (repetir não muda nada nem sobe a `version`).

- `deactivate`: impede login e refresh e **revoga os refresh tokens**. O access token já emitido vale até expirar (seção 4, item 7). Erros: `404`, `409 CANNOT_MODIFY_SELF` (desativar a si mesmo), `409 LAST_ADMIN` (último admin ativo; admin desativado não conta como "outro admin"), `409 USER_VERSION_OUTDATED` (alterado por outra pessoa durante a operação).
- `reactivate`: devolve o acesso a um usuário desativado e o **destrava**; num usuário já ativo não faz nada (para destravar uma conta ativa, use `reset-password`). Erros: `404`, `409 USER_VERSION_OUTDATED`.

### 5.7 `POST /users/:id/reset-password`

Sem corpo. Resposta `200`:

```json
{
  "user": { "...": "recurso User, com mustChangePassword: true" },
  "temporaryPassword": "Hk3$mP8z-Ty5nQw2"
}
```

Gera nova senha provisória (devolvida **uma única vez**, como no cadastro), exige a troca no próximo login, **destrava** a conta e **revoga todas as sessões** do usuário. Erros: `404 USER_NOT_FOUND`, `409 USER_VERSION_OUTDATED`. É também o caminho de "esqueci a senha": não há recuperação por e-mail.

### 5.8 Regras de administração

- Ninguém desativa nem muda o papel da **própria** conta (`CANNOT_MODIFY_SELF`).
- O sistema nunca fica sem **admin ativo**: desativar ou rebaixar o último admin ativo dá `LAST_ADMIN`. A regra vale também contra requisições simultâneas (dois admins se desativando ao mesmo tempo: uma delas falha com `LAST_ADMIN`).
- E-mail único sem diferenciar caixa (`EMAIL_ALREADY_REGISTERED`), inclusive entre desativados.
- Política de senha: de 10 a 128 caracteres (`WEAK_PASSWORD`); a nova senha na troca também não pode ser igual à atual.

## 6. Catálogo de erros desta área

Formato único (o mesmo da API toda): `{ "statusCode": 401, "code": "INVALID_CREDENTIALS", "message": "E-mail ou senha inválidos." }`; `400 INVALID_REQUEST` traz também `fields: [{ field, message }]`. O front escolhe a mensagem pelo `code` (as `message` abaixo estão em pt-BR e podem ser usadas como padrão).

| `code`                     | Status | `message`                                                                                                |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`          | 401    | Não autenticado.                                                                                         |
| `FORBIDDEN`                | 403    | Você não tem permissão para esta ação.                                                                   |
| `INVALID_CREDENTIALS`      | 401    | E-mail ou senha inválidos.                                                                               |
| `INVALID_REFRESH_TOKEN`    | 401    | Sessão inválida ou expirada. Entre novamente.                                                            |
| `ACCOUNT_LOCKED`           | 403    | Conta bloqueada por excesso de tentativas. Tente novamente em N minutos.                                 |
| `USER_DEACTIVATED`         | 403    | Usuário desativado. Procure um administrador.                                                            |
| `PASSWORD_CHANGE_REQUIRED` | 403    | Troque a senha provisória para continuar.                                                                |
| `INVALID_CURRENT_PASSWORD` | 400    | A senha atual não confere.                                                                               |
| `WEAK_PASSWORD`            | 400    | A senha deve ter entre 10 e 128 caracteres. (ou: A nova senha deve ser diferente da atual.)              |
| `INVALID_USER_NAME`        | 400    | O nome deve ter entre 1 e 120 caracteres                                                                 |
| `INVALID_EMAIL`            | 400    | Informe um e-mail válido (até 254 caracteres)                                                            |
| `INVALID_REQUEST`          | 400    | Requisição inválida (com `fields`)                                                                       |
| `USER_NOT_FOUND`           | 404    | Usuário não encontrado                                                                                   |
| `EMAIL_ALREADY_REGISTERED` | 409    | Já existe um usuário com este e-mail.                                                                    |
| `USER_VERSION_OUTDATED`    | 409    | Este usuário foi alterado por outra pessoa. Recarregue para ver a versão atual.                          |
| `LAST_ADMIN`               | 409    | Esta operação deixaria o sistema sem administrador ativo. Cadastre ou reative outro administrador antes. |
| `CANNOT_MODIFY_SELF`       | 409    | Você não pode desativar nem alterar o papel da sua própria conta.                                        |
| `TOO_MANY_REQUESTS`        | 429    | Muitas requisições. Tente novamente em instantes.                                                        |

Atenção para o front: `ACCOUNT_LOCKED`, `USER_DEACTIVATED` e `PASSWORD_CHANGE_REQUIRED` são `403`, mas **não** significam "sem permissão para a tela": trate `ACCOUNT_LOCKED` e `USER_DEACTIVATED` pelo `code` na tela de login e `PASSWORD_CHANGE_REQUIRED` levando o usuário à troca de senha. `403 FORBIDDEN` (sem permissão) é o único `403` que leva à página de acesso negado.

## 7. Segurança do login (para quem opera)

- **Equalização de tempo:** e-mail inexistente também gasta uma verificação argon2 (contra um hash descartável); a resposta é idêntica à de senha errada.
- **Bloqueio por conta:** `LOGIN_MAX_ATTEMPTS` (padrão 5) senhas erradas seguidas travam a conta por `LOGIN_LOCK_MINUTES` (padrão 15); a 5ª falha ainda responde `INVALID_CREDENTIALS` e a tentativa seguinte já recebe `ACCOUNT_LOCKED`. Login com sucesso zera o contador. Passado o bloqueio, a contagem recomeça do zero. Um administrador pode destravar antes com `reset-password` (ou `reactivate`, quando a conta estava desativada). A contagem é atômica no banco (requisições simultâneas não escapam dela). Como `ACCOUNT_LOCKED` só existe para e-mails cadastrados, ele revela que a conta existe depois de várias falhas; o limite por IP (abaixo) contém a enumeração.
- **Limite por IP:** `THROTTLE_LIMIT_PER_MINUTE` (padrão 300) em toda a API e `LOGIN_THROTTLE_LIMIT_PER_MINUTE` (padrão 10) adicional em `POST /auth/login` e `POST /auth/change-password` (`429 TOO_MANY_REQUESTS`).
- **Senhas:** argon2id (19 MiB de memória, 2 iterações, 1 de paralelismo). Senha, hash e token nunca vão para logs nem para respostas de erro.
- **IP do cliente atrás de proxy (`TRUST_PROXY`):** o limite por IP, o login e o `refresh_tokens.ip` usam `req.ip` do Express. Sem proxy confiável (`TRUST_PROXY=false`, padrão) o `X-Forwarded-For` é **ignorado** e vale o IP da conexão; atrás de Caddy/Render isso é o IP do proxy, ou seja, todos os usuários dividem o mesmo limite. Quando houver proxy reverso na frente da API, defina `TRUST_PROXY` com o número de proxies confiáveis (`1` para um Caddy; lista de IPs/sub-redes também vale). Aceita `false`, inteiro de 1 a 10 ou lista de IPs/sub-redes; **`true` e sub-redes `/0` são recusados** na subida. **Risco de saltos a mais:** o Express lê `X-Forwarded-For` da direita para a esquerda e pula os N últimos proxies; se N for maior que os proxies reais, a entrada escolhida é uma que o próprio cliente escreveu, e ele passa a forjar o IP (escapa do limite por IP do login e suja a auditoria). Saltos a menos só deixam o IP de um proxy (seguro, mas compartilhado). Use o menor valor correto e confira com um login (`refresh_tokens.ip` deve ser o seu IP; mandando um `X-Forwarded-For` falso ele não pode mudar). Por defesa, o `ip` só é gravado se for um endereço IP válido; senão fica nulo.
- **Configuração:** `JWT_SECRET` (mínimo 32 caracteres; obrigatório fora de `local`/`e2e`; gere com `openssl rand -base64 48`), `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `LOGIN_THROTTLE_LIMIT_PER_MINUTE`, `TRUST_PROXY`. Trocar o `JWT_SECRET` invalida todos os access tokens em circulação (os refresh tokens continuam, pois são opacos).
- **Primeiro acesso:** `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` criam o admin inicial na subida se a tabela `users` estiver vazia (ele precisa trocar a senha no primeiro login). Em desenvolvimento, `npm run seed:dev` cria `dev.admin@pauta.local`, `dev.editor@pauta.local` e `dev.leitor@pauta.local` com a senha só de desenvolvimento `dev-only-pauta-2026` e sem troca obrigatória (só roda com `STAGE` `local` ou `demo`).

## 8. Exemplos com `curl`

```bash
API=http://localhost:3000/api/v1

# login
curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"dev.admin@pauta.local","password":"dev-only-pauta-2026"}' | tee /tmp/login.json
TOKEN=$(jq -r .accessToken /tmp/login.json); REFRESH=$(jq -r .refreshToken /tmp/login.json)

# quem sou eu
curl -s $API/auth/user-info -H "authorization: Bearer $TOKEN"

# criar usuário com senha provisória gerada (anote: só aparece uma vez)
curl -s -X POST $API/users -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Maria Souza","email":"maria@bora.com.br","role":"content-brief-editor"}'

# primeiro acesso da Maria: o token vem restrito (mustChangePassword: true)
curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"maria@bora.com.br","password":"<senha provisória>"}' | tee /tmp/maria.json
MARIA=$(jq -r .accessToken /tmp/maria.json)
curl -s $API/content-briefs -H "authorization: Bearer $MARIA"
# 403 {"statusCode":403,"code":"PASSWORD_CHANGE_REQUIRED","message":"Troque a senha provisória para continuar."}

# troca de senha: devolve a sessão nova (mustChangePassword: false) e libera o resto
curl -s -X POST $API/auth/change-password -H "authorization: Bearer $MARIA" -H 'content-type: application/json' \
  -d '{"currentPassword":"<senha provisória>","newPassword":"minha-senha-nova-forte"}'

# renovar a sessão (o refresh token antigo deixa de valer)
curl -s -X POST $API/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}"

# reusar o refresh antigo: 401 INVALID_REFRESH_TOKEN e a família é revogada
curl -s -X POST $API/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}"
```
