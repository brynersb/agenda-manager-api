/**
 * Base dos objetos de valor. Os props são copiados e congelados na construção
 * (imutabilidade) e a igualdade é estrutural, não por referência.
 */
export abstract class ValueObject<Props extends object> {
  protected readonly props: Readonly<Props>;

  protected constructor(props: Props) {
    this.props = Object.freeze({ ...props });
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    return (
      other instanceof ValueObject &&
      other.constructor === this.constructor &&
      structurallyEqual(this.props, other.props)
    );
  }
}

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every(
    (key) =>
      Object.hasOwn(b, key) &&
      structurallyEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}
