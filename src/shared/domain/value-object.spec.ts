import { ValueObject } from '@/shared/domain/value-object';

class Period extends ValueObject<{ start: Date; tags: string[] }> {
  constructor(start: Date, tags: string[]) {
    super({ start, tags });
  }

  get tags(): readonly string[] {
    return this.props.tags;
  }
}

class Other extends ValueObject<{ value: number }> {
  constructor(value: number) {
    super({ value });
  }
}

describe('ValueObject', () => {
  it('compara estruturalmente, incluindo datas e listas', () => {
    const a = new Period(new Date('2026-01-01'), ['x', 'y']);
    const b = new Period(new Date('2026-01-01'), ['x', 'y']);

    expect(a.equals(b)).toBe(true);
  });

  it('é diferente quando um campo muda', () => {
    const a = new Period(new Date('2026-01-01'), ['x']);

    expect(a.equals(new Period(new Date('2026-01-02'), ['x']))).toBe(false);
    expect(a.equals(new Period(new Date('2026-01-01'), ['y']))).toBe(false);
    expect(a.equals(new Period(new Date('2026-01-01'), ['x', 'y']))).toBe(
      false,
    );
  });

  it('é diferente de outra classe e de valores que não são VO', () => {
    expect(new Other(1).equals(new Other(1))).toBe(true);
    expect(new Other(1).equals({ value: 1 })).toBe(false);
    expect(new Other(1).equals(undefined)).toBe(false);
  });

  it('congela os props (imutável)', () => {
    const period = new Period(new Date('2026-01-01'), ['x']);

    expect(
      Object.isFrozen((period as unknown as { props: object }).props),
    ).toBe(true);
  });
});
