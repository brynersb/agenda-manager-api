import type { ContentBriefData } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import type { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import type { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import type { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { InvalidDueDateError } from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Description } from '@/modules/content-brief/domain/value-objects/description';
import { Title } from '@/modules/content-brief/domain/value-objects/title';
import {
  CalendarDate,
  InvalidCalendarDateError,
} from '@/shared/domain/calendar-date';

/**
 * Campos de pauta como chegam ao use case (texto cru, sem value objects).
 * `status` nulo significa "padrão" ao criar e "manter" ao editar.
 */
export type ContentBriefDataInput = {
  title: string;
  description: string | null;
  dueDate: string | null;
  status: ContentBriefStatus | null;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estateDevelopmentId: string | null;
  ownerId: string | null;
};

/** Valida o texto cru e monta os `ContentBriefData` do domínio. */
export function toContentBriefData(
  input: ContentBriefDataInput,
): ContentBriefData {
  return {
    title: Title.create(input.title),
    description:
      input.description === null
        ? Description.empty()
        : Description.create(input.description),
    dueDate: parseDueDate(input.dueDate),
    status: input.status ?? undefined,
    action: input.action,
    channel: input.channel,
    estateDevelopmentId: input.estateDevelopmentId,
    ownerId: input.ownerId,
  };
}

/** `INVALID_DATE` do value object não é código público: vira `INVALID_REQUEST`. */
function parseDueDate(value: string | null): CalendarDate | null {
  if (value === null) {
    return null;
  }
  try {
    return CalendarDate.of(value);
  } catch (error) {
    if (error instanceof InvalidCalendarDateError) {
      throw new InvalidDueDateError(value);
    }
    throw error;
  }
}
