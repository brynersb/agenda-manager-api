import { type ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { createValidationPipe } from '@/shared/infrastructure/http/validation.pipe';

enum Color {
  Blue = 'BLUE',
  Green = 'GREEN',
}

class ItemDto {
  @IsString()
  label: string;
}

class ExampleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  name: string;

  @IsInt()
  @Min(1)
  @Max(10)
  amount: number;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(Color)
  color: Color;

  @IsString({ message: 'O título precisa ser um texto' })
  @IsOptional()
  title?: string;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  @ArrayMaxSize(2)
  @IsOptional()
  items?: ItemDto[];
}

const metadata: ArgumentMetadata = { type: 'body', metatype: ExampleDto };

async function fail(value: unknown) {
  const error = await createValidationPipe()
    .transform(value, metadata)
    .then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse() as {
    statusCode: number;
    code: string;
    message: string;
    fields: { field: string; message: string }[];
  };
}

describe('createValidationPipe', () => {
  it('aceita um corpo válido e transforma em instância do DTO', async () => {
    const result = await createValidationPipe().transform(
      { name: 'ok', amount: 3, color: 'BLUE' },
      metadata,
    );

    expect(result).toBeInstanceOf(ExampleDto);
  });

  it('devolve 400 INVALID_REQUEST com fields em pt-BR', async () => {
    const body = await fail({
      name: '',
      amount: 'abc',
      email: 'nao-e-email',
      color: 'ROXO',
    });

    expect(body).toMatchObject({
      statusCode: 400,
      code: 'INVALID_REQUEST',
      message: 'Requisição inválida',
    });
    expect(body.fields).toEqual(
      expect.arrayContaining([
        { field: 'name', message: 'name é obrigatório' },
        {
          field: 'amount',
          message: 'amount deve ser um número inteiro',
        },
        { field: 'email', message: 'email deve ser um e-mail válido' },
        {
          field: 'color',
          message: 'color deve ser um dos valores: BLUE, GREEN',
        },
      ]),
    );
  });

  it('traduz limites com o número da regra', async () => {
    const body = await fail({
      name: 'longo demais',
      amount: 11,
      color: 'BLUE',
    });

    expect(body.fields).toEqual(
      expect.arrayContaining([
        { field: 'name', message: 'name deve ter no máximo 5 caracteres' },
        {
          field: 'amount',
          message: 'amount deve ser menor ou igual a 10',
        },
      ]),
    );
  });

  it('recusa campos desconhecidos (forbidNonWhitelisted)', async () => {
    const body = await fail({
      name: 'ok',
      amount: 1,
      color: 'BLUE',
      intruder: true,
    });

    expect(body.fields).toEqual([
      { field: 'intruder', message: 'intruder não é um campo permitido' },
    ]);
  });

  it('preserva mensagem customizada escrita no DTO', async () => {
    const body = await fail({
      name: 'ok',
      amount: 1,
      color: 'BLUE',
      title: 123,
    });

    expect(body.fields).toEqual([
      { field: 'title', message: 'O título precisa ser um texto' },
    ]);
  });

  it('usa caminho com ponto e índice em objetos aninhados', async () => {
    const body = await fail({
      name: 'ok',
      amount: 1,
      color: 'BLUE',
      items: [{ label: 'a' }, { label: 5 }],
    });

    expect(body.fields).toEqual([
      {
        field: 'items[1].label',
        message: 'items[1].label deve ser um texto',
      },
    ]);
  });
});
