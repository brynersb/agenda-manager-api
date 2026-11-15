import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  RegistryQueryRepositoryInterface,
  RegistryStatus,
} from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import { ContentBriefEntity } from '@/modules/content-brief/infrastructure/persistence/entities/content-brief.entity';

/**
 * Camada anticorrupção: responde "o cadastro existe e está ativo?" lendo as
 * tabelas dos cadastros por SQL somente leitura. Não importa os módulos nem os
 * entities de empreendimento e responsável (plan §3.2).
 */
@Injectable()
export class RegistryQueryRepository
  implements RegistryQueryRepositoryInterface
{
  constructor(
    @InjectRepository(ContentBriefEntity)
    private readonly repository: Repository<ContentBriefEntity>,
  ) {}

  findEstateDevelopmentStatus(id: string): Promise<RegistryStatus> {
    return this.findStatusIn('estate_developments', id);
  }

  findOwnerStatus(id: string): Promise<RegistryStatus> {
    return this.findStatusIn('owners', id);
  }

  /** `table` é sempre uma das duas constantes acima, nunca entrada externa. */
  private async findStatusIn(
    table: 'estate_developments' | 'owners',
    id: string,
  ): Promise<RegistryStatus> {
    const rows: { active: boolean }[] = await this.repository.query(
      `SELECT active FROM ${table} WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      return 'missing';
    }
    return rows[0].active ? 'active' : 'archived';
  }
}
