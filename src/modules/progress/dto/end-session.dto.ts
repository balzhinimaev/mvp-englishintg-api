import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * POST /progress/sessions/:sessionId/end
 * extraXp жёстко ограничен: клиент не должен начислять себе произвольные тысячи XP.
 */
export class EndSessionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  extraXp?: number;
}
