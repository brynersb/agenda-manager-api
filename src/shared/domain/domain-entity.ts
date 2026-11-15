/**
 * Base das entidades de domínio. A identidade (e só ela) define a igualdade:
 * duas instâncias da mesma classe com o mesmo `id` são a mesma entidade,
 * mesmo que os demais campos difiram.
 */
export abstract class DomainEntity {
  protected constructor(readonly id: string) {}

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    return (
      other instanceof DomainEntity &&
      other.constructor === this.constructor &&
      other.id === this.id
    );
  }
}
