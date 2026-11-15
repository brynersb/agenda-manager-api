import { assertPasswordPolicy } from '@/modules/user/domain/services/password-policy';
import { CryptoPasswordGenerator } from '@/modules/user/infrastructure/services/crypto-password-generator';

describe('CryptoPasswordGenerator', () => {
  const generator = new CryptoPasswordGenerator();

  it('gera 16 caracteres que passam na política de senha', () => {
    const password = generator.generate();

    expect(password).toHaveLength(16);
    expect(() => assertPasswordPolicy(password)).not.toThrow();
  });

  it('inclui maiúscula, minúscula, dígito e símbolo, sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const password = generator.generate();

      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%&*?\-_=+]/);
      expect(password).not.toMatch(/[IlO01]/);
    }
  });

  it('gera senhas diferentes a cada chamada', () => {
    const passwords = new Set(
      Array.from({ length: 100 }, () => generator.generate()),
    );

    expect(passwords.size).toBe(100);
  });
});
