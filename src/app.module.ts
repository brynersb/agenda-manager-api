import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { type Env, validate } from '@/config/env.validation';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuthGuard } from '@/modules/auth/infrastructure/http/guards/auth.guard';
import { PermissionsGuard } from '@/modules/auth/infrastructure/http/guards/permissions.guard';
import { ContentBriefModule } from '@/modules/content-brief/content-brief.module';
import { EstateDevelopmentModule } from '@/modules/estate-development/estate-development.module';
import { HealthModule } from '@/modules/health/health.module';
import { OwnerModule } from '@/modules/owner/owner.module';
import { ClockModule } from '@/shared/infrastructure/clock/clock.module';
import { GlobalExceptionFilter } from '@/shared/infrastructure/filters/global-exception.filter';
import { RequestIdMiddleware } from '@/shared/infrastructure/http/request-id.middleware';
import { createValidationPipe } from '@/shared/infrastructure/http/validation.pipe';
import { LoggerModule } from '@/shared/infrastructure/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule,
    ClockModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: 60_000,
          limit: config.get('THROTTLE_LIMIT_PER_MINUTE', { infer: true }),
        },
      ],
    }),
    AuthModule,
    HealthModule,
    EstateDevelopmentModule,
    OwnerModule,
    ContentBriefModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    // A ordem dos APP_GUARD é a ordem de execução: o rate limit vem primeiro.
    // Throttler -> autenticação -> permissão; a ordem não pode mudar.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
