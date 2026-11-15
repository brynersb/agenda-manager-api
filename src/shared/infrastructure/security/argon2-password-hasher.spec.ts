import { Argon2PasswordHasher } from '@/shared/infrastructure/security/argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('gera um hash argon2id que não contém a senha', async () => {
    const hash = await hasher.hash('uma-senha-bem-longa');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('uma-senha-bem-longa');
  });

  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hasher.hash('uma-senha-bem-longa');

    await expect(hasher.verify('uma-senha-bem-longa', hash)).resolves.toBe(
      true,
    );
    await expect(hasher.verify('outra-senha-qualquer', hash)).resolves.toBe(
      false,
    );
  });

  it('usa um sal diferente a cada hash', async () => {
    const [a, b] = await Promise.all([
      hasher.hash('mesma-senha-12345'),
      hasher.hash('mesma-senha-12345'),
    ]);

    expect(a).not.toBe(b);
  });

  it('trata hash malformado como senha errada, sem lançar', async () => {
    await expect(hasher.verify('qualquer', 'isto-nao-e-um-hash')).resolves.toBe(
      false,
    );
    await expect(hasher.verify('qualquer', '')).resolves.toBe(false);
  });

  it('burnVerification termina sem erro e reaproveita o hash descartável', async () => {
    await expect(hasher.burnVerification('qualquer')).resolves.toBeUndefined();
    await expect(hasher.burnVerification('outra')).resolves.toBeUndefined();
  });
});
