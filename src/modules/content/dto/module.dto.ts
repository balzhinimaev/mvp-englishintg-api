import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
export type CEFR = 'A0'|'A1'|'A2'|'B1'|'B2'|'C1'|'C2';

export class MultilingualTextDto {
  @IsString()
  ru!: string;

  @IsString()
  en!: string;
}

export class OptionalMultilingualTextDto {
  @IsOptional()
  @IsString()
  ru?: string;

  @IsOptional()
  @IsString()
  en?: string;
}

export class CreateModuleDto {
  @IsString()
  moduleRef!: string; // a0.travel

  @IsString()
  level!: CEFR;

  @IsObject()
  @ValidateNested()
  @Type(() => MultilingualTextDto)
  title!: MultilingualTextDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OptionalMultilingualTextDto)
  description?: OptionalMultilingualTextDto;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPro?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class UpdateModuleDto extends CreateModuleDto {}

