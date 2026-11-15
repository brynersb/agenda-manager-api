import { InvalidTitleError } from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Title } from '@/modules/content-brief/domain/value-objects/title';

describe('Title', () => {
  it('remove espaços nas pontas', () => {
    expect(Title.create('  Post de lançamento  ').value).toBe(
      'Post de lançamento',
    );
  });

  it.each([
    ['1 caractere', 'a'],
    ['139 caracteres', 'a'.repeat(139)],
    ['140 caracteres', 'a'.repeat(140)],
  ])('aceita %s', (_label, text) => {
    expect(Title.create(text).value).toBe(text);
  });

  it('conta caracteres, não unidades UTF-16 (emoji vale 1)', () => {
    expect(Title.create('😀'.repeat(140)).value).toHaveLength(280);
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '     '],
    ['141 caracteres', 'a'.repeat(141)],
    ['141 depois do trim', ` ${'a'.repeat(141)} `],
  ])('recusa %s com INVALID_TITLE', (_label, text) => {
    expect(() => Title.create(text)).toThrow(InvalidTitleError);
    expect(() => Title.create(text)).toThrow(
      expect.objectContaining({ code: 'INVALID_TITLE', kind: 'VALIDATION' }),
    );
  });

  it('restore não valida de novo', () => {
    expect(Title.restore('').value).toBe('');
  });

  it('é igual por valor e imprime o texto', () => {
    expect(Title.create('A').equals(Title.create(' A '))).toBe(true);
    expect(String(Title.create('A'))).toBe('A');
  });
});
