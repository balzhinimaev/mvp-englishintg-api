import {
  Allow,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/** Лимит на сериализованный размер properties (хранится как Object в Mongo с TTL 60 дней). */
export const MAX_PROPERTIES_JSON_LENGTH = 4096;

/** Ограничение размера произвольного объекта по длине его JSON-сериализации. */
function MaxJsonLength(max: number, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'maxJsonLength',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (value === undefined || value === null) return true;
          try {
            return JSON.stringify(value).length <= (args.constraints[0] as number);
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} is too large (max ${args.constraints[0]} chars serialized)`;
        },
      },
    });
  };
}

/**
 * POST /events — трекинг аналитики из Mini App.
 * Фронт (frontend/src/services/tracking.ts) шлёт также userId и timestamp
 * на верхнем уровне — принимаем их, но userId берём ТОЛЬКО из JWT.
 */
export class TrackEventDto {
  @IsString()
  @Matches(/^[a-z0-9_.]+$/i, { message: 'name может содержать только буквы, цифры, "_" и "."' })
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsObject()
  @MaxJsonLength(MAX_PROPERTIES_JSON_LENGTH)
  properties?: Record<string, any>;

  /** Игнорируется сервером (userId берётся из JWT). Число (Telegram) или строка (em_* веб). */
  @Allow()
  userId?: number | string;

  /** Игнорируется сервером (ts проставляется сервером); фронт шлёт его в теле. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timestamp?: string;
}
