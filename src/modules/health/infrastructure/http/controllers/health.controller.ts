import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '@/modules/auth/infrastructure/http/decorators/public.decorator';

/**
 * Saúde do serviço. Fica fora do prefixo `/api` e sem versão (`/health`).
 * Inclui o indicador de banco (`database`). É a única rota pública da API.
 */
@ApiTags('health')
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Verificar a saúde do serviço' })
  @ApiResponse({
    status: 200,
    description: 'Serviço saudável (`database: up`)',
  })
  @ApiResponse({
    status: 503,
    description: 'Algum componente está indisponível (ex.: banco fora do ar)',
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
