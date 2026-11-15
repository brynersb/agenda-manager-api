import { DomainEntity } from '@/shared/domain/domain-entity';

class Example extends DomainEntity {
  constructor(
    id: string,
    readonly name: string,
  ) {
    super(id);
  }
}

class Other extends DomainEntity {
  constructor(id: string) {
    super(id);
  }
}

describe('DomainEntity', () => {
  it('é igual a outra instância da mesma classe com o mesmo id', () => {
    expect(new Example('1', 'a').equals(new Example('1', 'b'))).toBe(true);
  });

  it('é diferente quando o id muda', () => {
    expect(new Example('1', 'a').equals(new Example('2', 'a'))).toBe(false);
  });

  it('é diferente de outra classe com o mesmo id', () => {
    expect(new Example('1', 'a').equals(new Other('1'))).toBe(false);
  });

  it('é diferente de null e de valores que não são entidade', () => {
    const entity = new Example('1', 'a');

    expect(entity.equals(null)).toBe(false);
    expect(entity.equals({ id: '1' })).toBe(false);
  });
});
