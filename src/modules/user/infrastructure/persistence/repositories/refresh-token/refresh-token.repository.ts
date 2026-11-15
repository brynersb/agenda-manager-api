import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';
import { RefreshTokenEntity } from '@/modules/user/infrastructure/persistence/entities/refresh-token.entity';
import { RefreshTokenMapper } from '@/modules/user/infrastructure/persistence/mappers/refresh-token.mapper';

@Injectable()
export class RefreshTokenRepository implements RefreshTokenRepositoryInterface {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repository: Repository<RefreshTokenEntity>,
  ) {}

  async create(token: RefreshTokenDomainEntity): Promise<void> {
    await this.repository.insert(RefreshTokenMapper.toEntity(token));
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<RefreshTokenDomainEntity | null> {
    const entity = await this.repository.findOneBy({ tokenHash });
    return entity ? RefreshTokenMapper.toDomain(entity) : null;
  }

  async rotate(
    currentId: string,
    next: RefreshTokenDomainEntity,
    now: Date,
  ): Promise<boolean> {
    return this.repository.manager
      .transaction(async (tx) => {
        // O novo token entra primeiro porque `replaced_by_id` referencia o `id` dele.
        await tx.insert(RefreshTokenEntity, RefreshTokenMapper.toEntity(next));
        // `revoked_at IS NULL` torna a rotação atômica: de duas requisições com o
        // mesmo token, só uma revoga; a outra espera a primeira terminar, reavalia
        // a condição, não casa nenhuma linha e é tratada como reuso. O
        // QueryBuilder (e não `tx.query`) é de propósito: o `query` do TypeORM
        // devolve `[linhas, afetadas]` num UPDATE, o que esconderia o "0 linhas".
        const result = await tx
          .createQueryBuilder()
          .update(RefreshTokenEntity)
          .set({ revokedAt: now, replacedById: next.id })
          .where('id = :id AND revoked_at IS NULL', { id: currentId })
          .execute();
        if (!result.affected) {
          // Desfaz a inserção do novo token.
          throw new RotationRejected();
        }
        return true;
      })
      .catch((error: unknown) => {
        if (error instanceof RotationRejected) {
          return false;
        }
        throw error;
      });
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.repository.query(
      `UPDATE refresh_tokens SET revoked_at = $2
        WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId, now],
    );
  }

  async revokeAllByUserId(userId: string, now: Date): Promise<void> {
    await this.repository.query(
      `UPDATE refresh_tokens SET revoked_at = $2
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, now],
    );
  }
}

/** Sinaliza dentro da transação que o token já tinha sido usado (força o rollback). */
class RotationRejected extends Error {}
