import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards, BadRequestException, ForbiddenException, InternalServerErrorException, NotFoundException, Request } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { AnswerValidatorService, InvalidAnswerFormatError, LessonNotFoundError, TaskNotFoundError, ValidationDataError } from './answer-validator.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { DailyStat, DailyStatDocument } from '../common/schemas/daily-stat.schema';
import { XpTransaction, XpTransactionDocument } from '../common/schemas/xp-transaction.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../common/schemas/user-lesson-progress.schema';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const badRequestResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 400 },
    message: { type: 'string', example: 'Неверный формат ответа для order: ожидается JSON-массив строк, например ["What","time","is","it","?"]' },
    error: { type: 'string', example: 'Bad Request' },
  },
};

const notFoundResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 404 },
    message: { type: 'string', example: 'Lesson not found' },
    error: { type: 'string', example: 'Not Found' },
  },
};

const internalServerErrorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 500 },
    message: { type: 'string', example: 'Internal server error' },
    error: { type: 'string', example: 'Internal Server Error' },
  },
};

@Controller('progress')
@UseGuards(JwtAuthGuard)
@ApiTags('progress')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly validator: AnswerValidatorService,
    @InjectModel(DailyStat.name) private readonly dailyModel: Model<DailyStatDocument>,
    @InjectModel(XpTransaction.name) private readonly xpModel: Model<XpTransactionDocument>,
    @InjectModel(UserLessonProgress.name) private readonly ulpModel: Model<UserLessonProgressDocument>,
  ) {}

  @Post('sessions/start')
  async startSession(@Body() body: StartSessionDto, @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    const session = await this.progress.startSession(userId, { moduleRef: body.moduleRef, lessonRef: body.lessonRef, source: body.source });
    return { sessionId: (session as any)._id };
  }

  @Post('sessions/:sessionId/end')
  async endSession(
    @Param('sessionId') sessionId: string,
    @Body() body: EndSessionDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId; // Get userId from JWT token
    const session = await this.progress.endSession(sessionId, body?.extraXp || 0, String(userId));
    return { ok: Boolean(session) };
  }

  // 🔒 НОВЫЙ БЕЗОПАСНЫЙ ЭНДПОИНТ
  @Post('submit-answer')
  @ApiOperation({
    summary: 'Проверить ответ пользователя и сохранить попытку',
    description: 'Пример запроса:\n```json\n{\n  "lessonRef": "a0.basics.001",\n  "taskRef": "a0.basics.001.t1",\n  "userAnswer": "[\\"What\\",\\"time\\",\\"is\\",\\"it\\",\\"?\\"]",\n  "durationMs": 1200\n}\n```',
  })
  @ApiOkResponse({
    description: 'Результат проверки и данные попытки.',
    schema: {
      type: 'object',
      properties: {
        attemptId: { type: 'string', example: '64f9b6a0b3b6c92f4e2a1234' },
        isCorrect: { type: 'boolean', example: false },
        score: { type: 'number', example: 0.5 },
        feedback: { type: 'string', example: 'Check the word order' },
        correctAnswer: { type: 'string', example: 'What time is it ?' },
        explanation: { type: 'string', example: 'Порядок слов в вопросе.' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Ошибка валидации ответа.',
    schema: badRequestResponseSchema,
    examples: {
      invalidOrderFormat: {
        summary: 'Неверный формат order',
        value: {
          statusCode: 400,
          message: 'Неверный формат ответа для order: ожидается JSON-массив строк, например ["What","time","is","it","?"]',
          error: 'Bad Request',
        },
      },
      invalidMatchingFormat: {
        summary: 'Неверный формат matching',
        value: {
          statusCode: 400,
          message: 'Неверный формат ответа для matching: ожидается JSON-массив пар или объектов с left/right.',
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Урок или задание не найдены.',
    schema: notFoundResponseSchema,
  })
  @ApiInternalServerErrorResponse({
    description: 'Внутренняя ошибка сервера.',
    schema: internalServerErrorResponseSchema,
  })
  async submitAnswer(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: SubmitAnswerDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId; // Get userId from JWT token
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    try {
      // 🔒 ВАЛИДАЦИЯ НА СЕРВЕРЕ
      const validation = await this.validator.validateAnswer(
        body.lessonRef,
        body.taskRef,
        body.userAnswer
      );

      // Записываем попытку с результатом валидации
      const attempt = await this.progress.recordTaskAttempt({
        userId: userId,
        lessonRef: body.lessonRef,
        taskRef: body.taskRef,
        isCorrect: validation.isCorrect,
        score: validation.score,
        durationMs: body.durationMs,
        variantKey: body.variantKey,
        sessionId: body.sessionId,
        clientAttemptId: idempotencyKey,
        lastTaskIndex: body.lastTaskIndex,
        isLastTask: body.isLastTask,
        userAnswer: body.userAnswer,
        correctAnswer: validation.correctAnswer,
      });

      return {
        attemptId: (attempt as any)._id,
        isCorrect: validation.isCorrect,
        score: validation.score,
        feedback: validation.feedback,
        correctAnswer: validation.correctAnswer, // Показываем ПОСЛЕ ответа
        explanation: validation.explanation,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      if (error instanceof LessonNotFoundError || error instanceof TaskNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof InvalidAnswerFormatError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof ValidationDataError) {
        throw new InternalServerErrorException(error.message);
      }

      console.error('Answer validation error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(message);
    }
  }

  /**
   * @deprecated Устаревший эндпоинт. Используйте POST /progress/submit-answer.
   */
  // 🚨 СТАРЫЙ НЕБЕЗОПАСНЫЙ ЭНДПОИНТ (для обратной совместимости)
  @Post('attempts')
  @UseGuards(AdminGuard)
  async attempt(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body()
    body: {
      lessonRef: string;
      taskRef: string;
      isCorrect: boolean;
      score?: number;
      durationMs?: number;
      variantKey?: string;
      sessionId?: string;
      clientAttemptId?: string;
      lastTaskIndex?: number;
      isLastTask?: boolean;
      userAnswer?: string;
      correctAnswer?: string;
    },
    @Request() req: any,
  ) {
    const userId = req.user?.userId; // Get userId from JWT token
    console.warn(`⚠️ УСТАРЕВШИЙ ЭНДПОИНТ: /progress/attempts для ${body.taskRef}`);
    
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const attempt = await this.progress.recordTaskAttempt({
      userId: userId,
      lessonRef: body.lessonRef,
      taskRef: body.taskRef,
      isCorrect: body.isCorrect,
      score: body.score,
      durationMs: body.durationMs,
      variantKey: body.variantKey,
      sessionId: body.sessionId,
      clientAttemptId: idempotencyKey, // Используем заголовок как clientAttemptId
      lastTaskIndex: body.lastTaskIndex,
      isLastTask: body.isLastTask,
      userAnswer: body.userAnswer,
      correctAnswer: body.correctAnswer,
    });
    return { attemptId: (attempt as any)._id };
  }

  @Get('stats/daily')
  async daily(@Query('limit') limit = '14', @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    const items = await this.dailyModel
      .find({ userId: String(userId) })
      .sort({ dayKey: -1 })
      .limit(Number(limit))
      .lean();
    return { items };
  }

  @Get('xp')
  async xp(@Query('limit') limit = '50', @Request() req: any) {
    const userId = req.user?.userId; // Get userId from JWT token
    const items = await this.xpModel
      .find({ userId: String(userId) })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();
    return { items };
  }

  @Get('lessons')
  async lessons(@Request() req?: any, @Query() queryParams?: { status?: 'not_started' | 'in_progress' | 'completed' }) {
    const { status } = queryParams || {};
    const userId = req?.user?.userId; // Get userId from JWT token
    const dbQuery: any = { userId: String(userId) };
    if (status) dbQuery.status = status;
    const items = await this.ulpModel.find(dbQuery).sort({ updatedAt: -1 }).limit(100).lean();
    return { items };
  }
}
