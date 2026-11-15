import type { DataSource, EntityManager } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

import type { Seed } from '@/database/seeds/seed';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { Actor } from '@/shared/domain/actor';
import { RegistryName } from '@/shared/domain/registry-name';

/** Autor da auditoria de tudo que o seed grava. */
export const SEED_ACTOR: Actor = {
  id: 'seed',
  name: 'Seed de desenvolvimento',
};

type Example = {
  title: string;
  description: string;
  channel: ContentBriefChannel | null;
  /** Dias a partir de hoje; `null` = sem prazo. */
  dueInDays: number | null;
  status: ContentBriefStatus;
  estateDevelopment: string | null;
  owner: string | null;
  action: ContentBriefAction;
};

const ESTATE_DEVELOPMENTS = ['Residencial Exemplo', 'Comercial Exemplo'];
const OWNERS = ['Ana', 'Bruno'];

/*
 * As 6 pautas do array `EXEMPLOS` do protótipo, com os textos em português e
 * os valores de enum em inglês (ADR-015). Os prazos são relativos a "hoje" e
 * cobrem as seis situações da tela. Dois prazos diferem do protótipo (que não
 * tinha pauta para hoje nem sem prazo): o pagamento vence hoje (era +5) e o
 * acompanhamento de leads fica sem prazo (era +14), por ser recorrente.
 */
const EXAMPLES: readonly Example[] = [
  {
    title: 'Cobrar fotos da evolução da obra',
    description:
      'Pedir à construtora as fotos de outubro para usar nas redes e no site. Formato horizontal e alta resolução.',
    channel: null,
    dueInDays: -2,
    status: ContentBriefStatus.IN_PROGRESS,
    estateDevelopment: 'Residencial Exemplo',
    owner: 'Ana',
    action: ContentBriefAction.CHASE,
  },
  {
    title: 'Criar arte do plantão de vendas',
    description:
      'Arte para stories e feed com endereço, horário do plantão e QR code para agendar visita.',
    channel: ContentBriefChannel.INSTAGRAM,
    dueInDays: 2,
    status: ContentBriefStatus.IN_PROGRESS,
    estateDevelopment: 'Comercial Exemplo',
    owner: 'Bruno',
    action: ContentBriefAction.CREATE,
  },
  {
    title: 'Pagamento da agência de mídia paga',
    description:
      'Conferir a nota fiscal e enviar para o financeiro até o dia 13.',
    channel: null,
    dueInDays: 0,
    status: ContentBriefStatus.TODO,
    estateDevelopment: null,
    owner: 'Ana',
    action: ContentBriefAction.PAYMENT,
  },
  {
    title: 'Desenvolver página de lançamento',
    description:
      'Página com plantas, diferenciais e formulário de contato ligado ao CRM.',
    channel: ContentBriefChannel.WEBSITE,
    dueInDays: 9,
    status: ContentBriefStatus.TODO,
    estateDevelopment: 'Comercial Exemplo',
    owner: 'Bruno',
    action: ContentBriefAction.DEVELOP,
  },
  {
    title: 'Acompanhar leads do Google Ads',
    description:
      'Verificar toda semana o custo por lead e o retorno do time comercial.',
    channel: ContentBriefChannel.ADS,
    dueInDays: null,
    status: ContentBriefStatus.IN_PROGRESS,
    estateDevelopment: 'Residencial Exemplo',
    owner: 'Ana',
    action: ContentBriefAction.FOLLOW_UP,
  },
  {
    title: 'Analisar resultados de outubro',
    description:
      'Reunir alcance, cliques, leads e visitas ao plantão de outubro.',
    channel: ContentBriefChannel.REPORT,
    dueInDays: -4,
    status: ContentBriefStatus.DONE,
    estateDevelopment: null,
    owner: 'Bruno',
    action: ContentBriefAction.ANALYZE,
  },
];

/**
 * Cria o cadastro se o nome normalizado ainda não existe (o índice único
 * `ux_*_name` torna o `ON CONFLICT` idempotente) e devolve o id.
 */
async function ensureRegistry(
  manager: EntityManager,
  table: 'estate_developments' | 'owners',
  name: string,
  now: Date,
): Promise<string> {
  const registryName = RegistryName.create(name);
  await manager.query(
    `INSERT INTO ${table}
       (id, name, normalized_name, active, version,
        created_at, created_by, created_by_name,
        updated_at, updated_by, updated_by_name)
     VALUES ($1, $2, $3, true, 1, $4, $5, $6, $4, $5, $6)
     ON CONFLICT (normalized_name) DO NOTHING`,
    [
      uuidv7(),
      registryName.value,
      registryName.normalized,
      now,
      SEED_ACTOR.id,
      SEED_ACTOR.name,
    ],
  );
  const rows: { id: string }[] = await manager.query(
    `SELECT id FROM ${table} WHERE normalized_name = $1`,
    [registryName.normalized],
  );
  const [row] = rows;
  if (!row) {
    throw new Error(`Cadastro "${name}" não encontrado depois de criado`);
  }
  return row.id;
}

/**
 * Seed com os cadastros e as 6 pautas de exemplo do protótipo. Idempotente:
 * cadastros por nome normalizado; uma pauta de exemplo já existe (e não é
 * recriada) quando há pauta não excluída do autor `seed` com o mesmo título.
 * O relógio entra por parâmetro para o e2e fixar "hoje".
 */
export function createPrototypeExamplesSeed(
  getClock: () => ClockInterface,
): Seed {
  return {
    name: 'prototype-examples',
    async execute(dataSource: DataSource): Promise<void> {
      const clock = getClock();
      const today = clock.today();
      const now = clock.now();

      await dataSource.transaction(async (manager) => {
        const estateDevelopmentIds = new Map<string, string>();
        for (const name of ESTATE_DEVELOPMENTS) {
          estateDevelopmentIds.set(
            name,
            await ensureRegistry(manager, 'estate_developments', name, now),
          );
        }
        const ownerIds = new Map<string, string>();
        for (const name of OWNERS) {
          ownerIds.set(
            name,
            await ensureRegistry(manager, 'owners', name, now),
          );
        }

        for (const example of EXAMPLES) {
          const existing: unknown[] = await manager.query(
            `SELECT 1 FROM content_briefs
              WHERE created_by = $1 AND title = $2 AND deleted_at IS NULL`,
            [SEED_ACTOR.id, example.title],
          );
          if (existing.length > 0) {
            continue;
          }
          await manager.query(
            `INSERT INTO content_briefs
               (id, title, description, due_date, status, action, channel,
                estate_development_id, owner_id, completed_at, version,
                created_at, created_by, created_by_name,
                updated_at, updated_by, updated_by_name)
             VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, 1,
                     $11, $12, $13, $11, $12, $13)`,
            [
              uuidv7(),
              example.title,
              example.description,
              example.dueInDays === null
                ? null
                : today.addDays(example.dueInDays).toString(),
              example.status,
              example.action,
              example.channel,
              example.estateDevelopment
                ? estateDevelopmentIds.get(example.estateDevelopment)
                : null,
              example.owner ? ownerIds.get(example.owner) : null,
              example.status === ContentBriefStatus.DONE ? now : null,
              now,
              SEED_ACTOR.id,
              SEED_ACTOR.name,
            ],
          );
        }
      });
    },
  };
}
