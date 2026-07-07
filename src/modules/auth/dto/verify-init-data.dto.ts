import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * POST /auth/verify — initData из Telegram WebApp одной строкой
 * (window.Telegram.WebApp.initData, query-string формат с hash).
 */
export class VerifyInitDataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  initData!: string;
}
