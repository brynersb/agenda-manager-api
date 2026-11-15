import { InvalidDescriptionError } from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Description } from '@/modules/content-brief/domain/value-objects/description';

describe('Description', () => {
  it('remove espaços nas pontas', () => {
    expect(Description.create('  texto  ').value).toBe('texto');
  });

  it('aceita vazio e só espaços (viram vazio)', () => {
    expect(Description.create('').value).toBe('');
    expect(Description.create('   ').value).toBe('');
    expect(Description.empty().value).toBe('');
  });

  it.each([
    ['1199 caracteres', 1199],
    ['1200 caracteres', 1200],
  ])('aceita %s', (_label, length) => {
    expect(Description.create('a'.repeat(length)).value).toHaveLength(length);
  });

  it('recusa 1201 caracteres com INVALID_DESCRIPTION', () => {
    expect(() => Description.create('a'.repeat(1201))).toThrow(
      InvalidDescriptionError,
    );
    expect(() => Description.create('a'.repeat(1201))).toThrow(
      expect.objectContaining({
        code: 'INVALID_DESCRIPTION',
        kind: 'VALIDATION',
      }),
    );
  });

  it('o limite vale depois do trim', () => {
    expect(Description.create(` ${'a'.repeat(1200)} `).value).toHaveLength(
      1200,
    );
  });

  it('restore não valida de novo', () => {
    expect(Description.restore('x').value).toBe('x');
  });
});
