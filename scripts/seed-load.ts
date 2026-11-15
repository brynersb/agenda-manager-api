/*
 * Carga sintética para medir desempenho (T7): 30 empreendimentos, 15
 * responsáveis e 5.000 pautas num banco LOCAL, distribuídas em datas e status.
 *
 *   node scripts/seed-load.ts           # (re)cria a carga
 *   node scripts/seed-load.ts --clean   # só apaga a carga
 *
 * Tudo o que o script grava tem `created_by = 'load-test'`, e é só isso que o
 * `--clean` apaga: dados de verdade e o seed de exemplos não são tocados.
 * Roda direto do TypeScript (type stripping do Node): sem alias `@/` nem
 * decorators; a conexão vem do `typeorm.config.ts` (variáveis `DATABASE_*`).
 * Recusa qualquer host que não seja a própria máquina.
 */
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

import {
  buildDataSourceOptions,
  readDatabaseSettings,
} from '../src/database/typeorm.config.ts';

const LOAD_AUTHOR = 'load-test';
const LOAD_AUTHOR_NAME = 'Carga sintética';
const ESTATE_DEVELOPMENT_COUNT = 30;
const OWNER_COUNT = 15;
const CONTENT_BRIEF_COUNT = 5000;
const BATCH_SIZE = 500;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// O import acima já carregou o `.env`; as variáveis são as `DATABASE_*` da API.
const settings = readDatabaseSettings();

if (!LOCAL_HOSTS.has(settings.host)) {
  console.error(
    `[carga] recusado: "${settings.host}" não é um banco local (só localhost, 127.0.0.1 ou ::1).`,
  );
  process.exit(1);
}

const dataSource = new DataSource(buildDataSourceOptions(settings));

/** Gerador pseudoaleatório determinístico (mulberry32): a carga é reproduzível. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261114);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** Item sorteado com peso: `[valor, peso][]`. */
function pickWeighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let draw = random() * total;
  for (const [value, weight] of items) {
    draw -= weight;
    if (draw < 0) {
      return value;
    }
  }
  return (items.at(-1) as readonly [T, number])[0];
}

function todayIn(timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date: string, amount: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const STATUSES = [
  ['TODO', 30],
  ['IN_PROGRESS', 25],
  ['IN_REVIEW', 10],
  ['DONE', 35],
] as const;
const ACTIONS = [
  'CHASE',
  'DEVELOP',
  'PAYMENT',
  'CREATE',
  'FOLLOW_UP',
  'ANALYZE',
] as const;
const CHANNELS = [
  'INSTAGRAM',
  'EMAIL',
  'BLOG',
  'ADS',
  'VIDEO',
  'WEBSITE',
  'REPORT',
  'OTHER',
] as const;
const VERBS = [
  'Criar arte do',
  'Cobrar fotos do',
  'Revisar texto do',
  'Agendar post do',
  'Analisar resultados do',
  'Desenvolver página do',
  'Pagar fornecedor do',
  'Acompanhar leads do',
];
const SUBJECTS = [
  'plantão de vendas',
  'lançamento',
  'evento de inauguração',
  'newsletter de novembro',
  'anúncio de mídia paga',
  'vídeo institucional',
  'relatório mensal',
  'estande no shopping',
  'decorado',
  'campanha de indicação',
];
const DETAILS = [
  'Alinhar com a diretoria antes de publicar.',
  'Usar fotos em alta resolução e a logo atualizada.',
  'Conferir endereço, horário e QR code de agendamento.',
  'Enviar a nota fiscal ao financeiro até o fim da semana.',
  'Medir alcance, cliques e visitas ao plantão.',
  'Ligar com o CRM e testar o formulário de contato.',
];

/** Apaga as linhas da carga e devolve quantas saíram (o TypeORM devolve `[linhas, total]` num `DELETE`). */
async function deleteLoadRows(sql: string): Promise<number> {
  const [, deleted]: [unknown[], number] = await dataSource.query(sql, [
    LOAD_AUTHOR,
  ]);
  return deleted;
}

async function clean(): Promise<void> {
  const briefs = await deleteLoadRows(
    'DELETE FROM content_briefs WHERE created_by = $1 RETURNING 1',
  );
  const owners = await deleteLoadRows(
    'DELETE FROM owners WHERE created_by = $1 AND NOT EXISTS (SELECT 1 FROM content_briefs b WHERE b.owner_id = owners.id) RETURNING 1',
  );
  const estateDevelopments = await deleteLoadRows(
    'DELETE FROM estate_developments WHERE created_by = $1 AND NOT EXISTS (SELECT 1 FROM content_briefs b WHERE b.estate_development_id = estate_developments.id) RETURNING 1',
  );
  console.info(
    `[carga] apagado: ${briefs} pautas, ${owners} responsáveis, ${estateDevelopments} empreendimentos.`,
  );
}

async function insertRegistries(
  table: 'estate_developments' | 'owners',
  prefix: string,
  count: number,
  now: Date,
): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 1; index <= count; index++) {
    ids.push(uuidv7());
    const name = `${prefix} ${String(index).padStart(2, '0')}`;
    await dataSource.query(
      `INSERT INTO ${table}
         (id, name, normalized_name, active, version,
          created_at, created_by, created_by_name,
          updated_at, updated_by, updated_by_name)
       VALUES ($1, $2, $3, true, 1, $4, $5, $6, $4, $5, $6)`,
      [
        ids.at(-1),
        name,
        name.toLowerCase(),
        now,
        LOAD_AUTHOR,
        LOAD_AUTHOR_NAME,
      ],
    );
  }
  return ids;
}

async function load(): Promise<void> {
  await clean();

  const now = new Date();
  const today = todayIn(process.env.APP_TIMEZONE ?? 'America/Sao_Paulo');
  const estateDevelopmentIds = await insertRegistries(
    'estate_developments',
    'Carga Empreendimento',
    ESTATE_DEVELOPMENT_COUNT,
    now,
  );
  const ownerIds = await insertRegistries(
    'owners',
    'Carga Responsável',
    OWNER_COUNT,
    now,
  );

  const columns = [
    'id',
    'title',
    'description',
    'due_date',
    'status',
    'action',
    'channel',
    'estate_development_id',
    'owner_id',
    'completed_at',
    'version',
    'created_at',
    'created_by',
    'created_by_name',
    'updated_at',
    'updated_by',
    'updated_by_name',
  ];
  const casts = [
    '',
    '',
    '',
    '::date',
    '::content_brief_status',
    '::content_brief_action',
    '::content_brief_channel',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  for (let start = 0; start < CONTENT_BRIEF_COUNT; start += BATCH_SIZE) {
    const rows: string[] = [];
    const values: unknown[] = [];
    const size = Math.min(BATCH_SIZE, CONTENT_BRIEF_COUNT - start);
    for (let offset = 0; offset < size; offset++) {
      const status = pickWeighted(STATUSES);
      // 8% sem prazo; o resto de 60 dias atrás a 90 à frente.
      const dueDate =
        random() < 0.08
          ? null
          : addDays(today, Math.floor(random() * 150) - 60);
      const hasAction = random() < 0.85;
      const hasChannel = random() < 0.6;
      const row = [
        uuidv7(),
        `${pick(VERBS)} ${pick(SUBJECTS)} ${start + offset + 1}`,
        `${pick(DETAILS)} ${pick(DETAILS)} ${pick(DETAILS)}`,
        dueDate,
        status,
        hasAction ? pick(ACTIONS) : null,
        hasChannel ? pick(CHANNELS) : null,
        random() < 0.8 ? pick(estateDevelopmentIds) : null,
        random() < 0.9 ? pick(ownerIds) : null,
        status === 'DONE' ? now : null,
        1,
        now,
        LOAD_AUTHOR,
        LOAD_AUTHOR_NAME,
        now,
        LOAD_AUTHOR,
        LOAD_AUTHOR_NAME,
      ];
      const placeholders = row.map(
        (_, column) => `$${values.length + column + 1}${casts[column] ?? ''}`,
      );
      values.push(...row);
      rows.push(`(${placeholders.join(', ')})`);
    }
    await dataSource.query(
      `INSERT INTO content_briefs (${columns.join(', ')}) VALUES ${rows.join(', ')}`,
      values,
    );
  }

  await dataSource.query('ANALYZE content_briefs');
  await dataSource.query('ANALYZE estate_developments');
  await dataSource.query('ANALYZE owners');
  console.info(
    `[carga] criado: ${CONTENT_BRIEF_COUNT} pautas, ${OWNER_COUNT} responsáveis e ${ESTATE_DEVELOPMENT_COUNT} empreendimentos (referência: hoje = ${today}).`,
  );
}

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    if (process.argv.includes('--clean')) {
      await clean();
    } else {
      await load();
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    `[carga] falhou: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
