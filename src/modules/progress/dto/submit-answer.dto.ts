import { IsString, IsOptional, IsNumber, IsBoolean, Min, Matches } from 'class-validator';

export class SubmitAnswerDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @Matches(/^[a-z0-9]+\.[a-z0-9_]+\.\d{3}$/, {
    message: 'lessonRef должен иметь формат: level.module.###',
  })
  lessonRef!: string;

  @IsString()
  @Matches(/^[a-z0-9]+\.[a-z0-9_]+\.\d{3}\.[a-z0-9_]+$/, {
    message: 'taskRef должен иметь формат: level.module.###.taskId',
  })
  taskRef!: string;

  // 🔒 ФРОНТЕНД ОТПРАВЛЯЕТ ТОЛЬКО СВОЙ ОТВЕТ
  // Примеры: "Hello", "2", "[\"apple\",\"banana\"]"
  // Для order: "[\"What\",\"time\",\"is\",\"it\",\"?\"]"
  // Для matching: "[[0,1],[1,0]]" или "[{\"left\":\"cat\",\"right\":\"кот\"}]"
  @IsString()
  userAnswer!: string;

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
