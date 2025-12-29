import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const lessonStatusValues = ['completed', 'in_progress', 'not_started'] as const;
const lessonTypeValues = ['conversation', 'vocabulary', 'grammar'] as const;
const lessonDifficultyValues = ['easy', 'medium', 'hard'] as const;
const taskTypeValues = [
  'choice',
  'gap',
  'match',
  'listen',
  'speak',
  'order',
  'translate',
  'multiple_choice',
  'flashcard',
  'listening',
  'matching',
] as const;

export class LessonProgressDto {
  @ApiProperty({ description: 'Статус прохождения урока', enum: lessonStatusValues })
  status: 'completed' | 'in_progress' | 'not_started';

  @ApiProperty({ description: 'Баллы за урок' })
  score: number;

  @ApiProperty({ description: 'Количество попыток' })
  attempts: number;

  @ApiPropertyOptional({ description: 'Время завершения урока в ISO-формате' })
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Время, затраченное на урок, в секундах' })
  timeSpent?: number;
}

export class TaskDto {
  @ApiProperty({ description: 'Ссылка на задание' })
  ref: string;

  @ApiProperty({ description: 'Тип задания', enum: taskTypeValues })
  type: typeof taskTypeValues[number];

  @ApiProperty({ description: 'Данные задания' })
  data: Record<string, any>;
}

export class LessonItemDto {
  @ApiProperty({ description: 'Ссылка на урок' })
  lessonRef: string;

  @ApiProperty({ description: 'Ссылка на модуль' })
  moduleRef: string;

  @ApiProperty({ description: 'Название урока' })
  title: string;

  @ApiPropertyOptional({ description: 'Описание урока' })
  description?: string;

  @ApiProperty({ description: 'Оценка длительности в минутах' })
  estimatedMinutes: number;

  @ApiProperty({ description: 'Порядок урока в модуле' })
  order: number;

  @ApiPropertyOptional({ description: 'Тип урока', enum: lessonTypeValues })
  type?: typeof lessonTypeValues[number];

  @ApiPropertyOptional({ description: 'Сложность урока', enum: lessonDifficultyValues })
  difficulty?: typeof lessonDifficultyValues[number];

  @ApiPropertyOptional({ description: 'Теги урока', type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Награда в XP за урок' })
  xpReward?: number;

  @ApiPropertyOptional({ description: 'Наличие аудио' })
  hasAudio?: boolean;

  @ApiPropertyOptional({ description: 'Наличие видео' })
  hasVideo?: boolean;

  @ApiPropertyOptional({ description: 'Текст превью урока' })
  previewText?: string;

  @ApiPropertyOptional({ description: 'Типы заданий в уроке', isArray: true, enum: taskTypeValues })
  taskTypes?: Array<typeof taskTypeValues[number]>;

  @ApiPropertyOptional({ description: 'Прогресс пользователя по уроку', type: LessonProgressDto })
  progress?: LessonProgressDto;

  @ApiPropertyOptional({ description: 'Список заданий', type: [TaskDto] })
  tasks?: TaskDto[];
}
