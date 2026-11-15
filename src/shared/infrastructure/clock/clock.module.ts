import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '@/config/env.validation';
import { CLOCK } from '@/shared/application/interfaces/clock.interface';
import { SystemClock } from '@/shared/infrastructure/clock/system-clock';

/** Disponibiliza a porta `ClockInterface` (fuso `APP_TIMEZONE`) para toda a aplicação. */
@Global()
@Module({
  providers: [
    {
      provide: CLOCK,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SystemClock(config.get('APP_TIMEZONE', { infer: true })),
    },
  ],
  exports: [CLOCK],
})
export class ClockModule {}
