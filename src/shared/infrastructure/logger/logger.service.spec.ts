import type { Logger as WinstonLogger } from 'winston';

import { LoggerService } from '@/shared/infrastructure/logger/logger.service';

function create() {
  const winston = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const logger = new LoggerService(winston as unknown as WinstonLogger);
  return { winston, logger };
}

describe('LoggerService', () => {
  it('repassa cada nível ao Winston com os metadados', () => {
    const { winston, logger } = create();
    const meta = { 'evt.name': 'teste.evento' };

    logger.info('a', meta);
    logger.log('b', meta);
    logger.warn('c', meta);
    logger.error('d', meta);
    logger.debug('e', meta);

    expect(winston.info).toHaveBeenNthCalledWith(1, 'a', meta);
    expect(winston.info).toHaveBeenNthCalledWith(2, 'b', meta);
    expect(winston.warn).toHaveBeenCalledWith('c', meta);
    expect(winston.error).toHaveBeenCalledWith('d', meta);
    expect(winston.debug).toHaveBeenCalledWith('e', meta);
  });

  it('prefixa a mensagem quando há prefixo', () => {
    const { winston, logger } = create();

    logger.setLogPrefix('MyUseCase');
    logger.warn('algo aconteceu');

    expect(winston.warn).toHaveBeenCalledWith(
      '[MyUseCase] algo aconteceu',
      undefined,
    );
  });
});
