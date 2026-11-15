import { isUniqueViolation } from '@/shared/infrastructure/persistence/database-error.util';

describe('isUniqueViolation', () => {
  const driverError = {
    code: '23505',
    constraint: 'ux_estate_developments_name',
  };

  it('reconhece o erro do driver e o QueryFailedError que o embrulha', () => {
    expect(isUniqueViolation(driverError)).toBe(true);
    expect(isUniqueViolation({ driverError: driverError })).toBe(true);
  });

  it('filtra por constraint quando informada', () => {
    expect(isUniqueViolation(driverError, 'ux_estate_developments_name')).toBe(
      true,
    );
    expect(isUniqueViolation(driverError, 'ux_owners_name')).toBe(false);
  });

  it('ignora outros códigos e valores que não são erro', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});
