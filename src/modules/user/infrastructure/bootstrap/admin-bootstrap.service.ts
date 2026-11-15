import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '@/config/env.validation';
import {
  BOOTSTRAP_ADMIN_USE_CASE,
  type BootstrapAdminUseCaseInterface,
} from '@/modules/user/application/use-cases/bootstrap-admin/bootstrap-admin.use-case.interface';

/**
 * Ao subir, cria o administrador inicial se não existir nenhum usuário e o
 * ambiente trouxer `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. A regra
 * está no caso de uso; este serviço só liga o ciclo de vida do Nest às
 * variáveis de ambiente (a senha nunca é registrada em log).
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(
    @Inject(BOOTSTRAP_ADMIN_USE_CASE)
    private readonly bootstrapAdmin: BootstrapAdminUseCaseInterface,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapAdmin.execute({
      email: this.config.get('BOOTSTRAP_ADMIN_EMAIL', { infer: true }),
      password: this.config.get('BOOTSTRAP_ADMIN_PASSWORD', { infer: true }),
    });
  }
}
