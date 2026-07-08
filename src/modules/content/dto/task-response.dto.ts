import { Expose, Transform, Type } from 'class-transformer';
import { TaskTypeEnum } from '../../common/enums/task-type.enum';

/**
 * Response DTO для задач типа choice/multiple_choice.
 * Использует белый список (@Expose) для безопасности - correctIndex НЕ отправляется клиенту.
 */
export class ChoiceTaskResponseDto {
  @Expose()
  question!: string;

  @Expose()
  options!: string[];

  @Expose()
  hint?: string;

  @Expose()
  explanation?: string;

  // correctIndex НЕ помечен @Expose(), значит не попадет в JSON
}

/**
 * Response DTO для задач типа gap.
 */
export class GapTaskResponseDto {
  @Expose()
  text!: string;

  @Expose()
  hints?: string[];

  @Expose()
  hint?: string;

  @Expose()
  explanation?: string;

  @Expose()
  context?: string;

  @Expose()
  audioKey?: string;

  @Expose()
  caseInsensitive?: boolean;

  // answer и accept НЕ экспортируются
}

/**
 * Response DTO для задач типа listen/listening.
 */
export class ListenTaskResponseDto {
  @Expose()
  audioKey!: string;

  @Expose()
  question?: string;

  // Варианты MCQ — нужны фронту для отрисовки кнопок. Правильный вариант (correctIndex)
  // НЕ экспортируется, поэтому options безопасны (как в ChoiceTaskResponseDto).
  @Expose()
  options?: string[];

  @Expose()
  hint?: string;

  // translation НЕ экспортируется: это перевод правильного варианта — утёк бы ответ
  // на «What did you hear?» до проверки. transcript и correctIndex тоже срезаны.
}

/**
 * Response DTO для задач типа speak.
 */
export class SpeakTaskResponseDto {
  @Expose()
  prompt!: string;

  @Expose()
  hint?: string;

  // Модель произношения (озвучка target через TTS). Сам target не экспортируется —
  // audioUrl вычисляется маппером из target и безопасен для клиента.
  @Expose()
  audioUrl?: string;
}

/**
 * Response DTO для задач типа order.
 */
export class OrderTaskResponseDto {
  @Expose()
  tokens!: string[]; // Токены в перемешанном порядке на клиенте

  // Правильный порядок НЕ отправляется
}

/**
 * Response DTO для задач типа translate.
 */
export class TranslateTaskResponseDto {
  @Expose()
  question!: string;

  @Expose()
  hint?: string;

  // expected (правильные переводы) НЕ экспортируется
}

/**
 * Response DTO для задач типа flashcard.
 */
export class FlashcardTaskResponseDto {
  @Expose()
  front!: string;

  @Expose()
  example?: string;

  @Expose()
  audioKey?: string;

  @Expose()
  transcript?: string;

  @Expose()
  translation?: string;

  // back и expected НЕ экспортируются до того, как пользователь ответит
}

/**
 * Response DTO для пары в matching задаче.
 */
export class MatchingPairResponseDto {
  @Expose()
  @Transform(({ value, obj }) => value ?? obj?.english ?? '', { toClassOnly: true })
  left!: string;

  @Expose()
  @Transform(({ value, obj }) => value ?? obj?.russian ?? '', { toClassOnly: true })
  right!: string;

  @Expose()
  audioKey?: string;
}

/**
 * Response DTO для задач типа match/matching.
 */
export class MatchingTaskResponseDto {
  @Expose()
  @Transform(({ value, obj }) => value ?? obj?.instructions, { toClassOnly: true })
  instruction?: string;

  @Expose()
  @Type(() => MatchingPairResponseDto)
  pairs!: MatchingPairResponseDto[];

  // Правильные пары будут перемешаны на клиенте
}

/**
 * Общий Response DTO для задачи.
 * Использует динамический выбор класса на основе типа задачи.
 */
export class TaskResponseDto {
  @Expose()
  ref!: string;

  @Expose()
  type!: TaskTypeEnum;

  @Expose()
  @Type((options) => {
    const parent = options?.newObject as TaskResponseDto;
    if (!parent) return Object;

    switch (parent.type) {
      case TaskTypeEnum.CHOICE:
      case TaskTypeEnum.MULTIPLE_CHOICE:
        return ChoiceTaskResponseDto;
      case TaskTypeEnum.GAP:
        return GapTaskResponseDto;
      case TaskTypeEnum.LISTEN:
      case TaskTypeEnum.LISTENING:
        return ListenTaskResponseDto;
      case TaskTypeEnum.SPEAK:
        return SpeakTaskResponseDto;
      case TaskTypeEnum.ORDER:
        return OrderTaskResponseDto;
      case TaskTypeEnum.TRANSLATE:
        return TranslateTaskResponseDto;
      case TaskTypeEnum.FLASHCARD:
        return FlashcardTaskResponseDto;
      case TaskTypeEnum.MATCH:
      case TaskTypeEnum.MATCHING:
        return MatchingTaskResponseDto;
      default:
        return Object;
    }
  })
  data!: 
    | ChoiceTaskResponseDto
    | GapTaskResponseDto
    | ListenTaskResponseDto
    | SpeakTaskResponseDto
    | OrderTaskResponseDto
    | TranslateTaskResponseDto
    | FlashcardTaskResponseDto
    | MatchingTaskResponseDto
    | Record<string, any>;
}

