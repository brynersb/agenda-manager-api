import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { Actor } from '@/shared/domain/actor';

/**
 * Registra `content_brief.version_conflict` (warn, blocked): alguém tentou gravar sobre
 * uma versão que já não é a atual. `operation` diz qual escrita foi barrada.
 * Nunca recebe título nem descrição.
 */
export function recordVersionConflict(
  logger: LoggerServiceInterface,
  context: {
    contentBriefId: string;
    actor: Actor;
    operation: 'update' | 'change_status';
  },
): void {
  logger.warn('Escrita da pauta bloqueada: versão desatualizada', {
    'evt.name': 'content_brief.version_conflict',
    outcome: 'blocked',
    operation: context.operation,
    content_brief_id: context.contentBriefId,
    user_sub: context.actor.id,
    tags: ['content_brief', 'concurrency'],
  });
}
