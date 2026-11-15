/*
 * Mede a latência das consultas da tela principal (T7) com `fetch`, sem
 * dependência extra, e imprime p50/p95/p99. Meta do plano técnico (§8): p95
 * abaixo de 300 ms com 5 mil pautas.
 *
 *   TOKEN=<access token> node scripts/measure-load.ts
 *
 * Variáveis: `BASE_URL` (padrão http://localhost:3000), `TOKEN` (Bearer; omita
 * com o usuário mock da API), `REQUESTS` (por cenário, padrão 200),
 * `CONCURRENCY` (padrão 8) e `TARGET_MS` (padrão 300). Sai com código 1 se
 * algum p95 passar da meta. Para uma medição justa, suba a API com
 * `THROTTLE_LIMIT_PER_MINUTE` alto.
 */
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const token = process.env.TOKEN;
const requests = Number(process.env.REQUESTS ?? 200);
const concurrency = Number(process.env.CONCURRENCY ?? 8);
const targetMs = Number(process.env.TARGET_MS ?? 300);
const WARM_UP = 10;

const ALL_DUE_STATUSES = 'overdue,today,next-7-days,later,no-due-date';

const SCENARIOS: readonly { name: string; path: string }[] = [
  {
    name: 'lista (5 situações abertas, limit=200)',
    path: `/api/v1/content-briefs?dueStatus=${ALL_DUE_STATUSES}&limit=200`,
  },
  {
    name: 'lista (concluídas, -dueDate, limit=50)',
    path: '/api/v1/content-briefs?dueStatus=completed&sort=-dueDate&limit=50',
  },
  { name: 'resumo', path: '/api/v1/content-briefs/summary' },
  {
    name: 'busca q=plantao (lista, limit=200)',
    path: `/api/v1/content-briefs?dueStatus=${ALL_DUE_STATUSES}&q=plantao&limit=200`,
  },
  {
    name: 'busca q=plantao (resumo)',
    path: '/api/v1/content-briefs/summary?q=plantao',
  },
];

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * fraction) - 1,
  );
  return sorted[Math.max(0, index)] as number;
}

async function timedGet(path: string): Promise<number> {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  await response.arrayBuffer();
  const elapsed = performance.now() - started;
  if (!response.ok) {
    throw new Error(`${path} respondeu ${response.status}`);
  }
  return elapsed;
}

async function measure(path: string): Promise<number[]> {
  for (let index = 0; index < WARM_UP; index++) {
    await timedGet(path);
  }
  const samples: number[] = [];
  let remaining = requests;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (remaining > 0) {
        remaining--;
        samples.push(await timedGet(path));
      }
    }),
  );
  return samples.sort((a, b) => a - b);
}

async function main(): Promise<boolean> {
  let failed = false;
  console.info(
    `Alvo: ${baseUrl} | ${requests} requisições por cenário, concorrência ${concurrency}, meta p95 < ${targetMs} ms\n`,
  );
  for (const scenario of SCENARIOS) {
    const samples = await measure(scenario.path);
    const p95 = percentile(samples, 0.95);
    const mean =
      samples.reduce((sum, value) => sum + value, 0) / samples.length;
    if (p95 >= targetMs) {
      failed = true;
    }
    console.info(
      `${p95 < targetMs ? 'OK  ' : 'FALHA'} ${scenario.name}\n      média ${mean.toFixed(1)} ms | p50 ${percentile(samples, 0.5).toFixed(1)} | p95 ${p95.toFixed(1)} | p99 ${percentile(samples, 0.99).toFixed(1)} | máx ${(samples.at(-1) as number).toFixed(1)}`,
    );
  }
  return failed;
}

main()
  .then((failed) => {
    process.exitCode = failed ? 1 : 0;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
