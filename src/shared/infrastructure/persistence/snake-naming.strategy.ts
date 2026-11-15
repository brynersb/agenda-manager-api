import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

/** `createdByName` -> `created_by_name`; `ABCDef` -> `abc_def`. */
export function toSnakeCase(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Colunas em snake_case a partir de propriedades camelCase, sem lib externa:
 * cobre colunas comuns, embedded (com e sem prefixo) e join columns. `@Column({
 * name })` explícito sempre vence. Nomes de tabela, índices e chaves seguem o
 * padrão do TypeORM.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    if (customName) {
      return customName;
    }
    return toSnakeCase([...embeddedPrefixes, propertyName].join('_'));
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }

  override joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return this.joinTableColumnName(tableName, propertyName, columnName);
  }
}
