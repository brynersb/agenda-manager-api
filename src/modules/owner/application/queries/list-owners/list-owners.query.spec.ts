import { ListOwnersQuery } from '@/modules/owner/application/queries/list-owners/list-owners.query';

describe('ListOwnersQuery', () => {
  const items = [
    {
      id: 'a',
      name: 'Água Clara',
      email: null,
      active: true,
      version: 1,
      openContentBriefs: 2,
    },
    {
      id: 'b',
      name: 'Bela Vista',
      email: 'bela@bora.com',
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
    const query = new ListOwnersQuery(queryRepository);

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

    await new ListOwnersQuery(queryRepository).execute({
      includeArchived: false,
    });

    expect(queryRepository.findAll).toHaveBeenCalledWith({
      includeArchived: false,
    });
  });
});
