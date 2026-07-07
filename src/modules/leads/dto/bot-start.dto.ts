import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * UTM-метки из deep-link бота (bot/src/utils.ts::parsePayload).
 * Только 5 стандартных ключей; forbidNonWhitelisted отбросит всё лишнее.
 */
export class UtmDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_campaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utm_term?: string;
}

/**
 * POST /leads/bot_start — публичный лид от бота при /start.
 * Бот шлёт: { userId: number, utm: UTMParams (может быть {}), promoId?: string }.
 */
export class BotStartLeadDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UtmDto)
  utm?: UtmDto;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  promoId?: string;
}
