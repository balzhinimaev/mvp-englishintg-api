import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * PATCH /profile — обновление отображаемых полей профиля.
 * Только whitelist-поля: mass assignment (isAdmin, pro, xpTotal...) исключён на уровне DTO.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  languageCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  photoUrl?: string;
}
