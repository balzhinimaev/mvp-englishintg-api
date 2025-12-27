import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested, registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
export type CEFR = 'A0'|'A1'|'A2'|'B1'|'B2'|'C1'|'C2';

const isHalfStep = (value: number): boolean => Number.isInteger(value * 2);

const IsHalfStep = (validationOptions?: ValidationOptions) => (object: object, propertyName: string) => {
  registerDecorator({
    name: 'isHalfStep',
    target: object.constructor,
    propertyName,
    options: validationOptions,
    validator: {
      validate(value: number | undefined, _args: ValidationArguments) {
        if (value === undefined || value === null) {
          return true;
        }

        if (typeof value !== 'number' || Number.isNaN(value)) {
          return false;
        }

        return isHalfStep(value);
      },
      defaultMessage(args: ValidationArguments) {
        return `${args.property} must be in increments of 0.5`;
      }
    }
  });
};

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
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsHalfStep()
  difficultyRating?: number;

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
