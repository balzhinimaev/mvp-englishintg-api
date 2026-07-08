import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { VocabularyService } from './vocabulary.service';
import { 
  GetModuleVocabularyDto, 
  MarkWordLearnedDto, 
  UpdateWordProgressDto, 
  SyncModuleVocabularyDto,
  GetVocabularyProgressDto,
  GetUserWordProgressDto,
  VocabularyResponseDto,
  VocabularyProgressResponseDto,
  UserWordProgressResponseDto,
  SyncVocabularyResponseDto,
  VocabularyStatsResponseDto,
  ReviewSubmitDto
} from './dto/vocabulary.dto';

@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  /**
   * Get comprehensive vocabulary statistics for the current user
   * GET /vocabulary/stats
   * 
   * Returns statistics including:
   * - Summary (learned, learning, notStarted, total, percentage)
   * - By difficulty (easy, medium, hard)
   * - By category (travel, food, etc.)
   * - By part of speech (noun, verb, etc.)
   * - Recent activity
   * - Streak information
   * - Weekly progress
   */
  @Get('stats')
  async getVocabularyStats(
    @Request() req: any
  ): Promise<VocabularyStatsResponseDto> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    return await this.vocabularyService.getVocabularyStats(userId);
  }

  /**
   * Дневная очередь повторений: созревшие атомы + немного новых слов.
   * GET /vocabulary/review/queue
   */
  @Get('review/queue')
  async getReviewQueue(
    @Request() req: any,
    @Query('newLimit') newLimit?: string,
    @Query('reviewLimit') reviewLimit?: string,
    @Query('focus') focus?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('userId is required');
    return await this.vocabularyService.getReviewQueue(
      userId,
      {
        newLimit: newLimit ? Number(newLimit) : undefined,
        reviewLimit: reviewLimit ? Number(reviewLimit) : undefined,
      },
      focus === 'weak' ? 'weak' : 'due',
    );
  }

  /**
   * Обработать одно повторение/ввод атома (применяет SRS-планирование).
   * POST /vocabulary/review/submit
   */
  @Post('review/submit')
  async submitReview(@Request() req: any, @Body() body: ReviewSubmitDto) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('userId is required');
    return await this.vocabularyService.submitReview(userId, body.wordId, { mode: body.mode, choice: body.choice, stage: body.stage });
  }

  /**
   * Сводка по повторениям для главной/шапки.
   * GET /vocabulary/review/stats
   */
  @Get('review/stats')
  async getReviewStats(@Request() req: any) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('userId is required');
    return await this.vocabularyService.getReviewStats(userId);
  }

  /**
   * Get vocabulary for a specific module
   * GET /api/v2/vocabulary/modules/{moduleRef}
   */
  @Get('modules/:moduleRef')
  async getModuleVocabulary(
    @Param('moduleRef') moduleRef: string,
    @Request() req: any,
    @Query('lang') lang?: string
  ): Promise<VocabularyResponseDto> {
    // Basic validation
    if (!/^[a-z0-9]+\.[a-z0-9_]+$/.test(moduleRef)) {
      throw new BadRequestException('Invalid moduleRef format');
    }

    const userId = req.user?.userId;
    const result = await this.vocabularyService.getModuleVocabulary(moduleRef, userId);
    
    return {
      words: result.words,
      progress: result.progress
    };
  }

  /**
   * Get vocabulary progress statistics for a module
   * GET /api/v2/vocabulary/modules/{moduleRef}/progress
   */
  @Get('modules/:moduleRef/progress')
  async getVocabularyProgress(
    @Param('moduleRef') moduleRef: string,
    @Request() req: any
  ): Promise<VocabularyProgressResponseDto> {
    if (!/^[a-z0-9]+\.[a-z0-9_]+$/.test(moduleRef)) {
      throw new BadRequestException('Invalid moduleRef format');
    }

    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    return await this.vocabularyService.getVocabularyProgressStats(moduleRef, userId);
  }

  /**
   * Mark a word as learned
   * POST /api/v2/vocabulary/mark-learned
   */
  @Post('mark-learned')
  async markWordAsLearned(
    @Body() body: MarkWordLearnedDto,
    @Request() req: any
  ): Promise<UserWordProgressResponseDto> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    // Validate that the userId in body matches the JWT token
    if (body.userId !== userId) {
      throw new BadRequestException('userId mismatch');
    }

    return await this.vocabularyService.markWordAsLearned(
      body.userId,
      body.moduleRef,
      body.wordId
    );
  }

  /**
   * Update word learning progress
   * POST /api/v2/vocabulary/update-progress
   */
  @Post('update-progress')
  async updateWordProgress(
    @Body() body: UpdateWordProgressDto,
    @Request() req: any
  ): Promise<UserWordProgressResponseDto> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    // Validate that the userId in body matches the JWT token
    if (body.userId !== userId) {
      throw new BadRequestException('userId mismatch');
    }

    return await this.vocabularyService.updateWordProgress(
      body.userId,
      body.moduleRef,
      body.wordId,
      body.isCorrect,
      body.timeSpent || 0
    );
  }

  /**
   * Get user's progress for a specific word
   * GET /api/v2/vocabulary/words/{wordId}/progress
   */
  @Get('words/:wordId/progress')
  async getUserWordProgress(
    @Param('wordId') wordId: string,
    @Query('moduleRef') moduleRef: string,
    @Request() req: any
  ): Promise<UserWordProgressResponseDto | null> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (!moduleRef) {
      throw new BadRequestException('moduleRef is required');
    }

    return await this.vocabularyService.getUserWordProgress(userId, moduleRef, wordId);
  }

  /**
   * Sync vocabulary from lessons to database (Admin endpoint)
   * POST /api/v2/vocabulary/sync
   */
  @Post('sync')
  @UseGuards(AdminGuard)
  async syncModuleVocabulary(
    @Body() body: SyncModuleVocabularyDto
  ): Promise<SyncVocabularyResponseDto> {
    const result = await this.vocabularyService.syncModuleVocabulary(body.moduleRef);
    
    return {
      created: result.created,
      updated: result.updated,
      message: `Vocabulary synced for module ${body.moduleRef}. Created: ${result.created}, Updated: ${result.updated}`
    };
  }

  /**
   * Extract words from module lessons (Admin endpoint)
   * GET /api/v2/vocabulary/modules/{moduleRef}/extract
   */
  @Get('modules/:moduleRef/extract')
  @UseGuards(AdminGuard)
  async extractWordsFromModule(
    @Param('moduleRef') moduleRef: string
  ): Promise<{ words: any[]; count: number }> {
    if (!/^[a-z0-9]+\.[a-z0-9_]+$/.test(moduleRef)) {
      throw new BadRequestException('Invalid moduleRef format');
    }

    const words = await this.vocabularyService.extractWordsFromModule(moduleRef);
    
    return {
      words,
      count: words.length
    };
  }
}
