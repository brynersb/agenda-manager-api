#!/bin/sh
# Entrypoint da imagem de produção da API.
#
# Uso (via CMD/args da imagem):
#   docker-entrypoint.sh node dist/main   # padrão: sobe a API
#   docker-entrypoint.sh migrate          # só aplica as migrations e sai
#
# RUN_MIGRATIONS=true aplica as migrations compiladas (dist/) ANTES de subir a
# API. Se a migration falhar, o contêiner sai com erro e a API NÃO sobe (falha
# alto: o deploy fica vermelho em vez de rodar com o esquema pela metade).
# Padrão: false (a API em si nunca altera o esquema; ADR-004).
#
# Neon: a API pode usar o endpoint "pooled", mas as migrations devem usar o
# endpoint DIRETO. Defina MIGRATION_DATABASE_HOST com o host direto (sem
# `-pooler`); as demais variáveis DATABASE_* são as mesmas.
set -eu

run_migrations() {
  echo "[entrypoint] aplicando migrations (host: ${MIGRATION_DATABASE_HOST:-${DATABASE_HOST:-?}})..."
  # O prefixo de variável vale só para este comando; `set -e` derruba o script
  # (e o contêiner) se o typeorm sair com código diferente de zero.
  DATABASE_HOST="${MIGRATION_DATABASE_HOST:-${DATABASE_HOST:-}}" \
    node node_modules/typeorm/cli.js migration:run -d dist/database/typeorm.config.js
  echo "[entrypoint] migrations concluídas"
}

if [ "${1:-}" = "migrate" ]; then
  run_migrations
  exit 0
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  run_migrations
fi

exec "$@"
