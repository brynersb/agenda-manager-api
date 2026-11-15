import {
  SnakeNamingStrategy,
  toSnakeCase,
} from '@/shared/infrastructure/persistence/snake-naming.strategy';

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it('converte propriedades camelCase em colunas snake_case', () => {
    expect(strategy.columnName('createdByName', undefined, [])).toBe(
      'created_by_name',
    );
    expect(strategy.columnName('estateDevelopmentId', undefined, [])).toBe(
      'estate_development_id',
    );
    expect(strategy.columnName('name', undefined, [])).toBe('name');
  });

  it('respeita o nome explícito da coluna', () => {
    expect(strategy.columnName('normalizedName', 'FixedName', [])).toBe(
      'FixedName',
    );
  });

  it('junta o prefixo de embedded em snake_case', () => {
    expect(strategy.columnName('createdAt', undefined, ['audit'])).toBe(
      'audit_created_at',
    );
    expect(strategy.columnName('createdBy', undefined, ['auditData'])).toBe(
      'audit_data_created_by',
    );
  });

  it('converte join columns', () => {
    expect(strategy.joinColumnName('estate_development', 'id')).toBe(
      'estate_development_id',
    );
    expect(strategy.joinColumnName('mainOwner', 'id')).toBe('main_owner_id');
    expect(strategy.joinTableColumnName('content_briefs', 'tagId')).toBe(
      'content_briefs_tag_id',
    );
  });

  it('trata siglas seguidas de palavra', () => {
    expect(toSnakeCase('currentSsoUrl')).toBe('current_sso_url');
  });
});
