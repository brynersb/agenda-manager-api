import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/shared/domain/errors/domain-error';

describe('DomainError', () => {
  it.each([
    [NotFoundError, 'NOT_FOUND'],
    [ValidationError, 'VALIDATION'],
    [ConflictError, 'CONFLICT'],
    [ForbiddenError, 'FORBIDDEN'],
    [UnauthorizedError, 'UNAUTHORIZED'],
  ] as const)('%o carrega o kind %s, o code e a mensagem', (Klass, kind) => {
    const error = new Klass('CODE_X', 'Mensagem em pt-BR');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe(kind);
    expect(error.code).toBe('CODE_X');
    expect(error.message).toBe('Mensagem em pt-BR');
    expect(error.name).toBe(Klass.name);
  });

  it('subclasse de domínio herda o kind da base', () => {
    class ContentBriefNotFoundError extends NotFoundError {
      constructor() {
        super('CONTENT_BRIEF_NOT_FOUND', 'Pauta não encontrada');
      }
    }

    const error = new ContentBriefNotFoundError();

    expect(error.kind).toBe('NOT_FOUND');
    expect(error.name).toBe('ContentBriefNotFoundError');
  });
});
