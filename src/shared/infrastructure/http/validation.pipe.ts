import {
  BadRequestException,
  type ValidationError,
  ValidationPipe,
} from '@nestjs/common';

export const CODE_INVALID_REQUEST = 'INVALID_REQUEST';

export type InvalidField = { field: string; message: string };

/** Extrai os números/valores de uma mensagem padrão do class-validator. */
function numberOf(message: string): string {
  return message.match(/-?\d+(?:\.\d+)?/)?.[0] ?? '';
}

function valuesOf(message: string): string {
  return message.split(':').slice(1).join(':').trim();
}

/**
 * Tradutores das constraints mais comuns do class-validator. O que não estiver
 * aqui cai em "valor inválido": acrescente a constraint quando um DTO novo
 * usar um validador que ainda não está na tabela.
 */
const TRANSLATORS: Record<string, (field: string, original: string) => string> =
  {
    isString: (c) => `${c} deve ser um texto`,
    isNotEmpty: (c) => `${c} é obrigatório`,
    isDefined: (c) => `${c} é obrigatório`,
    isInt: (c) => `${c} deve ser um número inteiro`,
    isNumber: (c) => `${c} deve ser um número`,
    isBoolean: (c) => `${c} deve ser verdadeiro ou falso`,
    isEmail: (c) => `${c} deve ser um e-mail válido`,
    isUUID: (c) => `${c} deve ser um UUID válido`,
    isArray: (c) => `${c} deve ser uma lista`,
    isObject: (c) => `${c} deve ser um objeto`,
    isDateString: (c) => `${c} deve ser uma data válida`,
    isISO8601: (c) => `${c} deve ser uma data válida`,
    matches: (c) => `${c} tem formato inválido`,
    min: (c, o) => `${c} deve ser maior ou igual a ${numberOf(o)}`,
    max: (c, o) => `${c} deve ser menor ou igual a ${numberOf(o)}`,
    minLength: (c, o) => `${c} deve ter no mínimo ${numberOf(o)} caracteres`,
    maxLength: (c, o) => `${c} deve ter no máximo ${numberOf(o)} caracteres`,
    arrayMinSize: (c, o) => `${c} deve ter no mínimo ${numberOf(o)} itens`,
    arrayMaxSize: (c, o) => `${c} deve ter no máximo ${numberOf(o)} itens`,
    isEnum: (c, o) => `${c} deve ser um dos valores: ${valuesOf(o)}`,
    isIn: (c, o) => `${c} deve ser um dos valores: ${valuesOf(o)}`,
    nestedValidation: (c) => `${c} deve ser um objeto`,
    whitelistValidation: (c) => `${c} não é um campo permitido`,
  };

/**
 * Mensagem padrão do class-validator começa pelo nome da propriedade (ou por
 * `each value in`); mensagens customizadas (escritas em pt-BR no DTO) não, e
 * por isso são preservadas como estão.
 */
function isDefaultMessage(
  key: string,
  message: string,
  property: string,
): boolean {
  return (
    key === 'whitelistValidation' ||
    message.startsWith(property) ||
    message.startsWith('each value in ') ||
    message.startsWith('nested property ')
  );
}

function translate(
  key: string,
  message: string,
  field: string,
  property: string,
): string {
  if (!isDefaultMessage(key, message, property)) {
    return message;
  }
  return TRANSLATORS[key]?.(field, message) ?? `${field} é inválido`;
}

/** Achata a árvore de erros em `[{ field, message }]`, com caminho `a.b[0].c`. */
export function toInvalidFields(
  errors: ValidationError[],
  prefix = '',
): InvalidField[] {
  return errors.flatMap((error) => {
    const field = /^\d+$/.test(error.property)
      ? `${prefix}[${error.property}]`
      : prefix
        ? `${prefix}.${error.property}`
        : error.property;

    const fromField = Object.entries(error.constraints ?? {}).map(
      ([key, message]) => ({
        field,
        message: translate(key, message, field, error.property),
      }),
    );

    return [...fromField, ...toInvalidFields(error.children ?? [], field)];
  });
}

/**
 * `ValidationPipe` global (ADR-010): `whitelist` + `forbidNonWhitelisted` +
 * `transform`. Falhas viram `400 INVALID_REQUEST` com `fields` em pt-BR.
 * Registrado por `APP_PIPE` para valer também em e2e.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        statusCode: 400,
        code: CODE_INVALID_REQUEST,
        message: 'Requisição inválida',
        fields: toInvalidFields(errors),
      }),
  });
}
