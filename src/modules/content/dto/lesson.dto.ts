import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { TaskDto } from './task-data.dto';

export class CreateLessonDto {
  @IsString()
  moduleRef!: string;

  @IsString()
  lessonRef!: string;

  @IsString()
  title!: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsInt() @Min(1)
  estimatedMinutes?: number;

  @IsOptional() @IsInt() @Min(0)
  order?: number;

  @IsOptional() @IsBoolean()
  published?: boolean;

  @IsOptional() @IsString()
  type?: 'conversation'|'vocabulary'|'grammar';

  @IsOptional() @IsString()
  difficulty?: 'easy'|'medium'|'hard';

  @IsOptional() @IsArray()
  tags?: string[];

  @IsOptional() @IsInt() @Min(0)
  xpReward?: number;

  @IsOptional() @IsBoolean()
  hasAudio?: boolean;

  @IsOptional() @IsBoolean()
  hasVideo?: boolean;

  @IsOptional() @IsString()
  previewText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDto)
  tasks?: TaskDto[];
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}


