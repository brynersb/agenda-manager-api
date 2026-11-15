import { InvalidUserNameError } from '@/modules/user/domain/errors/user.errors';
import { UserName } from '@/modules/user/domain/value-objects/user-name';

describe('UserName', () => {
  it('apara e colapsa espaços', () => {
    expect(UserName.create('  Maria   de  Souza ').value).toBe(
      'Maria de Souza',
    );
  });

  it('aceita de 1 a 120 caracteres', () => {
    expect(UserName.create('A').value).toBe('A');
    expect(UserName.create('a'.repeat(120)).value).toHaveLength(120);
  });

  it.each(['', '   ', 'a'.repeat(121)])('recusa "%s"', (text) => {
    expect(() => UserName.create(text)).toThrow(InvalidUserNameError);
    expect(() => UserName.create(text)).toThrow(
      expect.objectContaining({ code: 'INVALID_USER_NAME' }),
    );
  });
});
