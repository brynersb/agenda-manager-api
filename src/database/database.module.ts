import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { Env } from '@/config/env.validation';
import { buildDataSourceOptions } from '@/database/typeorm.config';

/**
 * Conexão com o Postgres. O esquema só muda por migration rodada por comando
 * (`npm run migration:run`), nunca por `synchronize` nem no boot (ADR-004).
 * As opções vêm de `buildDataSourceOptions()` (a mesma da CLI de migrations),
 * alimentadas pelas variáveis `DATABASE_*` já validadas. Os módulos registram
 * suas entities com `TypeOrmModule.forFeature` (`autoLoadEntities`).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        ...buildDataSourceOptions({
          host: config.get('DATABASE_HOST', { infer: true }),
          port: config.get('DATABASE_PORT', { infer: true }),
          user: config.get('DATABASE_USER', { infer: true }),
          pass: config.get('DATABASE_PASS', { infer: true }),
          name: config.get('DATABASE_NAME', { infer: true }),
          ssl: config.get('DATABASE_SSL', { infer: true }),
          sslRejectUnauthorized: config.get(
            'DATABASE_SSL_REJECT_UNAUTHORIZED',
            { infer: true },
          ),
          poolMax: config.get('DATABASE_POOL_MAX', { infer: true }),
        }),
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
