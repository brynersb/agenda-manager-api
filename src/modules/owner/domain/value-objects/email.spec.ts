import {
  Email,
  InvalidEmailError,
} from '@/modules/owner/domain/value-objects/email';

describe('Email', () => {
  it('aceita um formato simples e remove espaços das pontas', () => {
    expect(Email.create('  ana@bora.com.br ').value).toBe('ana@bora.com.br');
  });

  it('aceita exatamente 254 caracteres', () => {
    const local = 'a'.repeat(254 - '@b.co'.length);

    expect(Email.create(`${local}@b.co`).value).toHaveLength(254);
  });

  it.each([
    ['sem arroba', 'ana.bora.com'],
    ['sem domínio', 'ana@'],
    ['sem ponto no domínio', 'ana@bora'],
    ['com espaço no meio', 'a na@bora.com'],
    ['duas arrobas', 'a@b@c.com'],
    ['empty', ''],
    ['255 caracteres', `${'a'.repeat(255 - '@b.co'.length)}@b.co`],
  ])('recusa e-mail %s com INVALID_EMAIL', (_description, text) => {
    expect(() => Email.create(text)).toThrow(InvalidEmailError);
    expect(() => Email.create(text)).toThrow(
      expect.objectContaining({ code: 'INVALID_EMAIL', kind: 'VALIDATION' }),
    );
  });

  it('createOrNull trata ausente e em branco como sem e-mail', () => {
    expect(Email.createOrNull(undefined)).toBeNull();
    expect(Email.createOrNull(null)).toBeNull();
    expect(Email.createOrNull('   ')).toBeNull();
    expect(Email.createOrNull('ana@bora.com')?.value).toBe('ana@bora.com');
  });

  it('createOrNull valida quando há texto', () => {
    expect(() => Email.createOrNull('invalid')).toThrow(InvalidEmailError);
  });

  it('é igual a outro e-mail com o mesmo valor', () => {
    expect(Email.create('a@b.co').equals(Email.create('a@b.co'))).toBe(true);
    expect(Email.create('a@b.co').equals(Email.create('c@b.co'))).toBe(false);
  });

  it('restaurar não valida de novo', () => {
    expect(Email.restore('qualquer coisa').value).toBe('qualquer coisa');
  });
});
