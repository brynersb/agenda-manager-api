import { ListEstateDevelopmentsQuery } from '@/modules/estate-development/application/queries/list-estate-developments/list-estate-developments.query';

describe('ListEstateDevelopmentsQuery', () => {
  const items = [
    {
      id: 'a',
      name: 'Água Clara',
      active: true,
      version: 1,
      openContentBriefs: 2,
    },
    {
      id: 'b',
      name: 'Bela Vista',
      active: true,
      version: 1,
      openContentBriefs: 0,
    },
  ];

  it('repassa o filtro e devolve o read model da leitura', async () => {
    const queryRepository = {
      findAll: vi.fn().mockResolvedValue(items),
      findOneById: vi.fn(),
    };
    const query = new ListEstateDevelopmentsQuery(queryRepository);

    await expect(query.execute({ includeArchived: true })).resolves.toBe(items);
    expect(queryRepository.findAll).toHaveBeenCalledWith({
      includeArchived: true,
    });
  });

  it('sem arquivados quando não pedidos', async () => {
    const queryRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      findOneById: vi.fn(),
    };

    await new ListEstateDevelopmentsQuery(queryRepository).execute({
      includeArchived: false,
    });

    expect(queryRepository.findAll).toHaveBeenCalledWith({
      includeArchived: false,
    });
  });
});
