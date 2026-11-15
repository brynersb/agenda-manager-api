import 'reflect-metadata';

import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

import { DURATION_PATTERN } from '@/config/duration';
import { DATABASE_LOCAL_DEFAULTS } from '@/database/database-defaults';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Ambiente lógico da POC (ADR-003/ADR-010); `demo` é a stack completa da T14. */
export enum Stage {
  Local = 'local',
  E2e = 'e2e',
  Demo = 'demo',
}

export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
}

const DEFAULT_CORS_ORIGINS = 'http://localhost:5173';
const STAGES_WITH_DEFAULT_CORS: readonly Stage[] = [Stage.Local, Stage.E2e];

/**
 * Segredo JWT de desenvolvimento: só vale em `local` e `e2e` (placeholder
 * público, nunca um segredo real). Fora deles `JWT_SECRET` é obrigatória e
 * este valor é recusado.
 */
export const DEV_JWT_SECRET =
  'dev-only-insecure-jwt-secret-do-not-use-in-production';
const STAGES_WITH_DEFAULT_JWT_SECRET: readonly Stage[] = [
  Stage.Local,
  Stage.E2e,
];
const JWT_SECRET_MIN_LENGTH = 32;
const BOOTSTRAP_EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Postgres do `docker/compose.yaml` (porta 5433 do host); só vale em `local`. */
const DATABASE_DEFAULTS_LOCAL = {
  DATABASE_HOST: DATABASE_LOCAL_DEFAULTS.host,
  DATABASE_PORT: DATABASE_LOCAL_DEFAULTS.port,
  DATABASE_USER: DATABASE_LOCAL_DEFAULTS.user,
  DATABASE_PASS: DATABASE_LOCAL_DEFAULTS.pass,
  DATABASE_NAME: DATABASE_LOCAL_DEFAULTS.name,
  DATABASE_SSL: false,
} as const;

const VALID_TIME_ZONES: readonly string[] = [
  'UTC',
  ...Intl.supportedValuesOf('timeZone'),
];

/**
 * O `enableImplicitConversion` do class-transformer converte com `Boolean(v)`,
 * e `Boolean('false')` é `true`. Por isso o parsing é explícito: só a string
 * `'true'` liga; ausente cai no padrão.
 */
function toBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === true || value === 'true';
}

/** `'true'`/`'false'` viram boolean; qualquer outro valor segue cru e falha em `@IsBoolean`. */
function parseStrictBoolean(value: unknown): unknown {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === '';
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsEnum(Stage)
  STAGE: Stage = Stage.Local;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsIn(VALID_TIME_ZONES, {
    message:
      'APP_TIMEZONE deve ser um fuso IANA válido (ex.: America/Sao_Paulo)',
  })
  APP_TIMEZONE: string = 'America/Sao_Paulo';

  /**
   * CSV de origens permitidas. O padrão (`http://localhost:5173`) só existe em
   * `local`/`e2e`; fora deles a variável é obrigatória (preenchida em `validate`).
   */
  @IsNotEmpty({
    message: 'CORS_ORIGINS é obrigatório quando STAGE não é local nem e2e',
  })
  CORS_ORIGINS: string;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT_PER_MINUTE: number = 300;

  @Transform(({ obj }) => toBoolean(obj.SWAGGER_ENABLED, true))
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  /**
   * Conexão com o Postgres, em variáveis separadas. Os padrões (`localhost:5433`,
   * usuário, senha e banco `pauta`) só existem em `local`; fora dele as cinco e
   * `DATABASE_SSL` são obrigatórias (preenchidas em `validate`).
   */
  @IsNotEmpty({
    message: 'DATABASE_HOST é obrigatória quando STAGE não é local',
  })
  DATABASE_HOST: string;

  @IsInt({
    message:
      'DATABASE_PORT deve ser um número inteiro entre 1 e 65535 (obrigatória quando STAGE não é local)',
  })
  @Min(1, {
    message:
      'DATABASE_PORT deve ser um número inteiro entre 1 e 65535 (obrigatória quando STAGE não é local)',
  })
  @Max(65535, {
    message:
      'DATABASE_PORT deve ser um número inteiro entre 1 e 65535 (obrigatória quando STAGE não é local)',
  })
  DATABASE_PORT: number;

  @IsNotEmpty({
    message: 'DATABASE_USER é obrigatória quando STAGE não é local',
  })
  DATABASE_USER: string;

  @IsNotEmpty({
    message: 'DATABASE_PASS é obrigatória quando STAGE não é local',
  })
  DATABASE_PASS: string;

  @IsNotEmpty({
    message: 'DATABASE_NAME é obrigatória quando STAGE não é local',
  })
  DATABASE_NAME: string;

  /**
   * TLS na conexão: `true` para Neon/produção, `false` no Postgres local.
   * Parsing estrito (só `true` ou `false`) e sem padrão fora de `local`, para
   * ninguém subir em produção sem TLS por esquecimento.
   */
  @Transform(({ obj }) => parseStrictBoolean(obj.DATABASE_SSL))
  @IsBoolean({
    message:
      'DATABASE_SSL deve ser true ou false (obrigatória quando STAGE não é local)',
  })
  DATABASE_SSL: boolean;

  /** Só tem efeito com `DATABASE_SSL=true`. */
  @Transform(({ obj }) => toBoolean(obj.DATABASE_SSL_REJECT_UNAUTHORIZED, true))
  @IsBoolean()
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolean = true;

  @IsInt()
  @Min(1)
  DATABASE_POOL_MAX: number = 10;

  /**
   * Segredo HMAC dos access tokens (HS256), mínimo de 32 caracteres. O padrão
   * de desenvolvimento só existe em `local`/`e2e`; fora deles é obrigatório
   * (preenchido em `validate`). Nunca é registrado em log.
   * Gere com `openssl rand -base64 48`.
   */
  @IsNotEmpty({
    message: 'JWT_SECRET é obrigatório quando STAGE não é local nem e2e',
  })
  @MinLength(JWT_SECRET_MIN_LENGTH, {
    message: `JWT_SECRET deve ter no mínimo ${JWT_SECRET_MIN_LENGTH} caracteres`,
  })
  JWT_SECRET: string;

  /** `iss` fixo do access token. */
  @IsNotEmpty({ message: 'JWT_ISSUER não pode ser vazio' })
  JWT_ISSUER: string = 'pauta-mkt-api';

  /** `aud` fixo do access token. */
  @IsNotEmpty({ message: 'JWT_AUDIENCE não pode ser vazio' })
  JWT_AUDIENCE: string = 'pauta-mkt';

  /** Validade do access token (`15m`, `1h`...). */
  @Matches(DURATION_PATTERN, {
    message:
      'JWT_ACCESS_TTL deve ser um inteiro positivo seguido de s, m, h ou d (ex.: 15m)',
  })
  JWT_ACCESS_TTL: string = '15m';

  /** Validade do refresh token (`7d`...). */
  @Matches(DURATION_PATTERN, {
    message:
      'JWT_REFRESH_TTL deve ser um inteiro positivo seguido de s, m, h ou d (ex.: 7d)',
  })
  JWT_REFRESH_TTL: string = '7d';

  /** Falhas de senha seguidas que bloqueiam a conta. */
  @IsInt()
  @Min(1)
  LOGIN_MAX_ATTEMPTS: number = 5;

  /** Minutos de bloqueio da conta depois de `LOGIN_MAX_ATTEMPTS` falhas. */
  @IsInt()
  @Min(1)
  LOGIN_LOCK_MINUTES: number = 15;

  /** Limite de requisições por minuto, por IP, nas rotas de login e troca de senha. */
  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_LIMIT_PER_MINUTE: number = 10;

  /**
   * Administrador inicial: criado ao subir só se não existir nenhum usuário e
   * as duas variáveis estiverem definidas (as duas ou nenhuma). Só o formato é
   * validado quando definidas. O admin nasce com `mustChangePassword = true`.
   */
  @ValidateIf((c: EnvironmentVariables) => !isBlank(c.BOOTSTRAP_ADMIN_EMAIL))
  @Matches(BOOTSTRAP_EMAIL_FORMAT, {
    message: 'BOOTSTRAP_ADMIN_EMAIL deve ser um e-mail válido',
  })
  @MaxLength(254, {
    message: 'BOOTSTRAP_ADMIN_EMAIL deve ter no máximo 254 caracteres',
  })
  BOOTSTRAP_ADMIN_EMAIL?: string;

  @ValidateIf((c: EnvironmentVariables) => !isBlank(c.BOOTSTRAP_ADMIN_PASSWORD))
  @MinLength(10, {
    message: 'BOOTSTRAP_ADMIN_PASSWORD deve ter no mínimo 10 caracteres',
  })
  @MaxLength(128, {
    message: 'BOOTSTRAP_ADMIN_PASSWORD deve ter no máximo 128 caracteres',
  })
  BOOTSTRAP_ADMIN_PASSWORD?: string;
}

/** Tipo usado em `ConfigService<Env, true>` com `{ infer: true }`. */
export type Env = EnvironmentVariables;

export function validate(config: Record<string, unknown>): Env {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  if (
    (validated.CORS_ORIGINS === undefined || validated.CORS_ORIGINS === '') &&
    STAGES_WITH_DEFAULT_CORS.includes(validated.STAGE)
  ) {
    validated.CORS_ORIGINS = DEFAULT_CORS_ORIGINS;
  }

  if (
    isBlank(config.JWT_SECRET) &&
    STAGES_WITH_DEFAULT_JWT_SECRET.includes(validated.STAGE)
  ) {
    validated.JWT_SECRET = DEV_JWT_SECRET;
  }

  if (validated.STAGE === Stage.Local) {
    for (const key of Object.keys(DATABASE_DEFAULTS_LOCAL) as Array<
      keyof typeof DATABASE_DEFAULTS_LOCAL
    >) {
      if (isBlank(config[key])) {
        Object.assign(validated, { [key]: DATABASE_DEFAULTS_LOCAL[key] });
      }
    }
  }

  const errors = validateSync(validated, { skipMissingProperties: false });
  const details = errors.map(
    (error) =>
      ` - ${error.property}: ${[...new Set(Object.values(error.constraints ?? {}))].join('; ')}`,
  );

  // Trava de segurança: o segredo de desenvolvimento nunca vale fora de local/e2e.
  if (
    validated.JWT_SECRET === DEV_JWT_SECRET &&
    !STAGES_WITH_DEFAULT_JWT_SECRET.includes(validated.STAGE)
  ) {
    details.push(
      ` - JWT_SECRET: o segredo de desenvolvimento não é aceito com STAGE=${validated.STAGE}; gere um segredo próprio (openssl rand -base64 48)`,
    );
  }

  // Administrador inicial: as duas variáveis ou nenhuma.
  if (
    isBlank(validated.BOOTSTRAP_ADMIN_EMAIL) !==
    isBlank(validated.BOOTSTRAP_ADMIN_PASSWORD)
  ) {
    details.push(
      ' - BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD devem ser definidos juntos (ou nenhum dos dois)',
    );
  }

  if (details.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida:\n${details.join('\n')}`,
    );
  }

  return validated;
}
