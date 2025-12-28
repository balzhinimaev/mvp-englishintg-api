import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class SubmitAnswerDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  lessonRef!: string;

  @IsString()
  taskRef!: string;

  // 🔒 ФРОНТЕНД ОТПРАВЛЯЕТ ТОЛЬКО СВОЙ ОТВЕТ
  @IsString()
  userAnswer!: string; // Например: "Hello", "2", "['apple','banana']"

  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  variantKey?: string; // Для заданий с вариантами

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsNumber()
  lastTaskIndex?: number;

  @IsOptional()
  @IsBoolean()
  isLastTask?: boolean;
}
