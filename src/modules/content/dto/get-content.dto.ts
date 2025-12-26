import { IsString, IsOptional, IsEnum, Length, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetModulesDto {
  @IsOptional()
  @IsEnum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  level?: string;

  @IsOptional()
  @IsEnum(['ru', 'en'])
  lang?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class GetLessonsDto {
  @IsOptional()
  @IsString()
  moduleRef?: string;

  @IsOptional()
  @IsEnum(['ru', 'en'])
  lang?: string;
}

export class GetLessonDto {
  @IsOptional()
  @IsEnum(['ru', 'en'])
  lang?: string;
}
