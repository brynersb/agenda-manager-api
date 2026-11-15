# Runbook: Keycloak local

> **SOMENTE DESENVOLVIMENTO LOCAL.** O realm `bora` deste repositório (`docker/keycloak/realm-bora.json`) tem usuários de teste com senha `dev`, o client `pauta-mkt-dev-cli` (Direct Access Grants), `sslRequired: none` e admin `admin/admin`. Nada disso deve ser copiado para um ambiente real. Se a POC virar produto, o realm real não terá usuários de teste, nem o `dev-cli`, e usará HTTPS.

Imagem: `quay.io/keycloak/keycloak:26.8.2` (tag exata), modo `start-dev --import-realm`.

## Subir

```bash
docker compose -f docker/compose.yaml --profile auth up -d          # só Keycloak
docker compose -f docker/compose.yaml --profile db --profile auth up -d   # Postgres (5433) + Keycloak (8080)
docker compose -f docker/compose.yaml ps                            # aguarde "healthy" (~40 s na primeira vez)
```

O realm só é importado se ainda não existir no volume `pauta-mkt-api_pauta-keycloak-data`. Depois de editar `realm-bora.json`, é preciso zerar o volume do Keycloak:

```bash
docker compose -f docker/compose.yaml --profile auth rm -sf keycloak
docker volume rm pauta-mkt-api_pauta-keycloak-data
docker compose -f docker/compose.yaml --profile auth up -d
```

(Evite `docker compose down -v`: ele apaga também o volume do Postgres.)

## URLs

| O quê         | URL                                                                                  |
| ------------- | ------------------------------------------------------------------------------------ |
| Console admin | http://localhost:8080/admin (usuário `admin`, senha `admin`)                         |
| Issuer        | `http://localhost:8080/realms/bora` (= `OIDC_ISSUER_URL`)                            |
| Discovery     | http://localhost:8080/realms/bora/.well-known/openid-configuration                   |
| JWKS          | http://localhost:8080/realms/bora/protocol/openid-connect/certs                      |
| Token         | `POST http://localhost:8080/realms/bora/protocol/openid-connect/token`               |
| Saúde         | http://localhost:9000/health/ready (porta de gerenciamento; não é publicada no host) |

Audience esperada pela API: `OIDC_AUDIENCE=pauta-mkt-api`. Claim de papéis: `realm_access.roles`.

### Console admin: "HTTPS required"

O Keycloak trata como "externo" qualquer origem que não seja endereço privado e, no Docker Desktop, o IP de origem visto pelo contêiner pode ser público (VPN, WARP). O realm `bora` já usa `sslRequired: none`; o realm `master` (console admin) não. Se o console recusar o login com "HTTPS required":

```bash
docker exec pauta-mkt-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin
docker exec pauta-mkt-keycloak /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
```

## Clients

| Client              | Tipo                                                                          | Uso                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pauta-mkt-ui`      | público, Authorization Code + PKCE S256 obrigatório, sem Direct Access Grants | login do front (`http://localhost:5173`). Redirect `http://localhost:5173/*`, web origins `http://localhost:5173`, post-logout `http://localhost:5173/*`. Emite refresh token (`signinSilent`) |
| `pauta-mkt-api`     | confidencial, sem fluxos                                                      | só existe para ser audience                                                                                                                                                                    |
| `pauta-mkt-dev-cli` | público, **só** Direct Access Grants                                          | obter token por `curl`. Somente local                                                                                                                                                          |

O client scope `pauta-mkt-api-audience` (audience mapper para `pauta-mkt-api`) é padrão do `pauta-mkt-ui` e do `pauta-mkt-dev-cli`. Sem ele o `aud` do access token seria `account` e a API recusaria.

## Usuários de teste

| Usuário         | Senha | Nome            | E-mail                      | Papel                                    |
| --------------- | ----- | --------------- | --------------------------- | ---------------------------------------- |
| `dev.editor`    | `dev` | Ana Editora     | dev.editor@exemplo.local    | `content-brief-editor`                   |
| `dev.leitor`    | `dev` | Lucas Leitor    | dev.leitor@exemplo.local    | `content-brief-viewer`                   |
| `dev.sem-papel` | `dev` | Sofia Sem Papel | dev.sem-papel@exemplo.local | nenhum (a API devolve `permissions: []`) |

O login aceita usuário ou e-mail. Tokens: access 5 min, SSO idle 30 min, SSO max 10 h.

## Obter e decodificar um token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/bora/protocol/openid-connect/token \
  -d grant_type=password -d client_id=pauta-mkt-dev-cli \
  -d username=dev.editor -d password=dev | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')

# Mostra só os claims de interesse (não imprime o token)
python3 - "$TOKEN" <<'EOF'
import base64, json, sys
p = sys.argv[1].split('.')[1]
c = json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)))
print({k: c.get(k) for k in ['iss', 'aud', 'azp', 'realm_access', 'name', 'preferred_username', 'email', 'exp']})
EOF
```

Resultado esperado para `dev.editor`: `iss = http://localhost:8080/realms/bora`, `aud = pauta-mkt-api`, `realm_access.roles = ['content-brief-editor']`, `name = Ana Editora`.

## Chamar a API com o token (depois da T3)

```bash
curl -s http://localhost:3000/api/v1/auth/user-info -H "Authorization: Bearer $TOKEN"
```

Com a API configurada com `OIDC_ISSUER_URL=http://localhost:8080/realms/bora` e `OIDC_AUDIENCE=pauta-mkt-api`. Nunca cole o token em log, issue ou chat.

## Exportar o realm depois de mudar algo no console

O export pelo console não inclui usuários. Use o `kc.sh` com o Keycloak parado (o banco H2 do `start-dev` fica no volume):

```bash
mkdir -p /tmp/kc-export
docker compose -f docker/compose.yaml --profile auth stop keycloak
docker compose -f docker/compose.yaml --profile auth run --rm --no-deps \
  -v /tmp/kc-export:/tmp/export --entrypoint /opt/keycloak/bin/kc.sh keycloak \
  export --realm bora --users same_file --file /tmp/export/realm-bora.json
docker compose -f docker/compose.yaml --profile auth start keycloak
```

Na versão 26 o valor `realm_file` de `--users` não existe: para exportar em um único arquivo use `same_file`. Revise o arquivo exportado (ele traz ids, hashes de senha e segredos gerados) antes de substituir `docker/keycloak/realm-bora.json`.

## Reaproveitamento na stack em contêiner (T14)

A stack da demonstração monta este mesmo `realm-bora.json`. O navegador acessa o Keycloak por `localhost:8080` e a API por `keycloak:8080`; o `iss` do token precisa ser o mesmo nos dois casos (`KC_HOSTNAME` externo e `OIDC_JWKS_URI` interno). O realm não fixa hostname: isso é configuração do serviço, não do realm.
