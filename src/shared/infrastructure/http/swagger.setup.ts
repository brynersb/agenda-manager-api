import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Nome do esquema Bearer; os controllers usam `@ApiBearerAuth('bearer')`. */
export const SWAGGER_BEARER = 'bearer';

/** Publica o Swagger em `/docs` (fora do prefixo `/api`). */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Pauta de marketing Bora API')
    .setDescription(
      'API da pauta de marketing: pautas, empreendimentos, responsáveis e usuários. Para autenticar: `POST /api/v1/auth/login` e use o `accessToken` em "Authorize".',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token (JWT HS256) devolvido por `POST /api/v1/auth/login`. Vale 15 minutos; renove com `POST /api/v1/auth/refresh`.',
      },
      SWAGGER_BEARER,
    )
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
