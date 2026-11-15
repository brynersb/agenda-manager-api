import { InvalidUserEmailError } from '@/modules/user/domain/errors/user.errors';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';

describe('UserEmail', () => {
  it('normaliza para minúsculas e sem espaços nas pontas', () => {
    expect(UserEmail.create('  Maria.Souza@Bora.COM.br ').value).toBe(
      'maria.souza@bora.com.br',
    );
  });

  it('normalize não valida (usado no login)', () => {
    expect(UserEmail.normalize('  Qualquer Coisa ')).toBe('qualquer coisa');
  });

  it.each(['', 'sem-arroba', 'a@b', 'a b@c.d', '@x.com'])(
    'recusa "%s" com INVALID_EMAIL',
    (text) => {
      expect(() => UserEmail.create(text)).toThrow(InvalidUserEmailError);
      expect(() => UserEmail.create(text)).toThrow(
        expect.objectContaining({ code: 'INVALID_EMAIL', kind: 'VALIDATION' }),
      );
    },
  );

  it('recusa acima de 254 caracteres', () => {
    expect(() => UserEmail.create(`${'a'.repeat(250)}@x.com`)).toThrow(
      InvalidUserEmailError,
    );
  });

  it('dois e-mails que só diferem na caixa são iguais', () => {
    expect(
      UserEmail.create('A@x.com').equals(UserEmail.create('a@X.com')),
    ).toBe(true);
  });
});
