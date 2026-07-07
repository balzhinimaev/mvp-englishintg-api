import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /progress/sessions/start
 * Фронт (frontend/src/services/lessonRuntime.ts) шлёт { moduleRef?, lessonRef?, source? }.
 * userId берётся из JWT.
 */
export class StartSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  moduleRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  lessonRef?: string;

  @IsOptional()
  @IsIn(['reminder', 'home', 'deeplink', 'unknown'])
  source?: 'reminder' | 'home' | 'deeplink' | 'unknown';
}
