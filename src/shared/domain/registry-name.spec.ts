import {
  InvalidRegistryNameError,
  RegistryName,
} from '@/shared/domain/registry-name';

describe('RegistryName', () => {
  it('aplica trim e colapsa espaços internos', () => {
    expect(RegistryName.create('  Residencial   \t Ipê  ').value).toBe(
      'Residencial Ipê',
    );
  });

  it('normaliza sem caixa e sem acento (ç vira c)', () => {
    expect(RegistryName.create('Residencial Ipê').normalized).toBe(
      'residencial ipe',
    );
    expect(RegistryName.create('AÇAÍ ÀS Ñ').normalized).toBe('acai as n');
  });

  it('é igual a outro nome com o mesmo normalizado', () => {
    const a = RegistryName.create('Residencial Ipê');
    const b = RegistryName.create('  residencial   ipe ');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(RegistryName.create('Residencial Ipês'))).toBe(false);
    expect(a.equals('Residencial Ipê')).toBe(false);
  });

  it('aceita 1 e 80 caracteres', () => {
    expect(RegistryName.create('a').value).toBe('a');
    expect(RegistryName.create('a'.repeat(80)).value).toHaveLength(80);
  });

  it('conta o tamanho depois de normalizar os espaços', () => {
    const withSpaces = `${'a'.repeat(40)}      ${'b'.repeat(39)}`;

    expect(RegistryName.create(withSpaces).value).toHaveLength(80);
  });

  it.each([
    ['empty', ''],
    ['só espaços', '   \t '],
    ['81 caracteres', 'a'.repeat(81)],
  ])('recusa %s com INVALID_REGISTRY_NAME', (_description, text) => {
    expect(() => RegistryName.create(text)).toThrow(InvalidRegistryNameError);
    expect(() => RegistryName.create(text)).toThrow(
      expect.objectContaining({
        code: 'INVALID_REGISTRY_NAME',
        kind: 'VALIDATION',
      }),
    );
  });

  it('restaurar não valida de novo', () => {
    expect(RegistryName.restore('x'.repeat(200)).value).toHaveLength(200);
  });

  it('é imutável', () => {
    const name = RegistryName.create('Bela Vista');

    expect(() => {
      (name as unknown as { props: { value: string } }).props.value = 'Other';
    }).toThrow(TypeError);
  });
});
