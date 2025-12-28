import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { TaskDto } from './task-data.dto';
import { MultilingualTextDto, OptionalMultilingualTextDto } from './module.dto';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@ValidatorConstraint({ name: 'LessonRefMatchesModuleRef', async: false })
class LessonRefMatchesModuleRefConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const dto = args.object as CreateLessonDto;
    if (typeof value !== 'string' || typeof dto?.moduleRef !== 'string') return false;
    const pattern = new RegExp(`^${escapeRegExp(dto.moduleRef)}\\.\\d{3}$`);
    return pattern.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateLessonDto;
    const moduleRef = typeof dto?.moduleRef === 'string' ? dto.moduleRef : '<moduleRef>';
    return `lessonRef must match ${moduleRef}.NNN`;
  }
}

export class CreateLessonDto {
  @IsString()
  moduleRef!: string;

  @IsString()
  @Validate(LessonRefMatchesModuleRefConstraint)
  lessonRef!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => MultilingualTextDto)
  title!: MultilingualTextDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OptionalMultilingualTextDto)
  description?: OptionalMultilingualTextDto;

  @IsOptional() @IsInt() @Min(1)
  estimatedMinutes?: number;

  @IsOptional() @IsInt() @Min(0)
  order?: number;

  @IsOptional() @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsEnum(['conversation', 'vocabulary', 'grammar'])
  type?: 'conversation'|'vocabulary'|'grammar';

  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'])
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
