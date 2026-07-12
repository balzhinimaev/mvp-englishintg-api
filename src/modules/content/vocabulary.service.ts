import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VocabularyItem, VocabularyDocument } from '../common/schemas/vocabulary.schema';
import { UserVocabularyProgress, UserVocabularyProgressDocument } from '../common/schemas/user-vocabulary-progress.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Lesson, LessonDocument } from '../common/schemas/lesson.schema';
import { VocabularyItem as VocabularyItemType, UserVocabularyProgress as UserVocabularyProgressType, VocabularyProgressStats } from '../common/types/content';
import { VocabularyMapper, UserVocabularyProgressMapper } from '../common/utils/mappers';
import { schedule, Grade } from './srs';
import { GrammarAtom, GrammarAtomDocument } from '../common/schemas/grammar-atom.schema';
import { UserLessonProgress, UserLessonProgressDocument } from '../common/schemas/user-lesson-progress.schema';
import {
  VocabularyStatsResponseDto,
  VocabularySummaryDto,
  VocabularyByDifficultyDto,
  VocabularyCategoryStatsDto,
  VocabularyPartOfSpeechStatsDto,
  VocabularyRecentActivityDto,
  VocabularyStreakDto,
  VocabularyWeeklyProgressDto,
  VocabularyDifficultyStatsDto
} from './dto/vocabulary.dto';

// Category name translations
const CATEGORY_NAMES: Record<string, string> = {
  travel: 'Путешествия',
  food: 'Еда и напитки',
  family: 'Семья',
  work: 'Работа',
  health: 'Здоровье',
  shopping: 'Покупки',
  weather: 'Погода',
  hobbies: 'Хобби',
  education: 'Образование',
  technology: 'Технологии',
  sports: 'Спорт',
  culture: 'Культура',
  nature: 'Природа',
  home: 'Дом',
  transport: 'Транспорт',
  emotions: 'Эмоции',
  business: 'Бизнес',
  music: 'Музыка',
  art: 'Искусство',
  animals: 'Животные',
  clothes: 'Одежда',
  body: 'Тело',
  time: 'Время',
  numbers: 'Числа',
  colors: 'Цвета',
  greetings: 'Приветствия',
  common: 'Общие слова',
};

@Injectable()
export class VocabularyService {
  constructor(
    @InjectModel(VocabularyItem.name) private readonly vocabularyModel: Model<VocabularyDocument>,
    @InjectModel(UserVocabularyProgress.name) private readonly progressModel: Model<UserVocabularyProgressDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(GrammarAtom.name) private readonly grammarModel: Model<GrammarAtomDocument>,
    @InjectModel(UserLessonProgress.name) private readonly lessonProgressModel: Model<UserLessonProgressDocument>,
  ) {}

  /**
   * Extract vocabulary words from lessons in a module
   */
  async extractWordsFromModule(moduleRef: string): Promise<VocabularyItemType[]> {
    // Get all lessons in the module
    const lessons = await this.lessonModel
      .find({ moduleRef, published: true })
      .lean();

    const wordMap = new Map<string, VocabularyItemType>();

    for (const lesson of lessons) {
      if (!lesson.tasks) continue;

      for (const task of lesson.tasks) {
        // Extract words from flashcard tasks
        if (task.type === 'flashcard' && task.data) {
          const { front, back, example, audioKey } = task.data;
          
          if (front && back) {
            const wordId = this.generateWordId(front, moduleRef);
            
            if (!wordMap.has(wordId)) {
              wordMap.set(wordId, {
                id: wordId,
                word: front,
                translation: back,
                examples: example ? [{ original: example, translation: '' }] : [],
                audioKey: audioKey || this.generateAudioKey(lesson.lessonRef, task.ref, front),
                difficulty: this.determineDifficulty(front),
                tags: this.extractTagsFromLesson(lesson),
                lessonRefs: [],
                moduleRefs: [moduleRef],
                occurrenceCount: 0
              });
            }

            const word = wordMap.get(wordId)!;
            if (!word.lessonRefs!.includes(lesson.lessonRef)) {
              word.lessonRefs!.push(lesson.lessonRef);
            }
            word.occurrenceCount!++;
          }
        }

        // Extract words from matching tasks
        if (task.type === 'matching' && task.data?.pairs) {
          for (const pair of task.data.pairs) {
            if (pair.left && pair.right) {
              const wordId = this.generateWordId(pair.left, moduleRef);
              
              if (!wordMap.has(wordId)) {
                wordMap.set(wordId, {
                  id: wordId,
                  word: pair.left,
                  translation: pair.right,
                  examples: [],
                  audioKey: pair.audioKey || this.generateAudioKey(lesson.lessonRef, task.ref, pair.left),
                  difficulty: this.determineDifficulty(pair.left),
                  tags: this.extractTagsFromLesson(lesson),
                  lessonRefs: [],
                  moduleRefs: [moduleRef],
                  occurrenceCount: 0
                });
              }

              const word = wordMap.get(wordId)!;
              if (!word.lessonRefs!.includes(lesson.lessonRef)) {
                word.lessonRefs!.push(lesson.lessonRef);
              }
              word.occurrenceCount!++;
            }
          }
        }
      }
    }

    return Array.from(wordMap.values());
  }

  /**
   * Get vocabulary for a specific module with user progress
   */
  async getModuleVocabulary(moduleRef: string, userId?: string): Promise<{
    words: VocabularyItemType[];
    progress?: VocabularyProgressStats;
  }> {
    // Get all vocabulary items for the module
    const vocabularyItems = await this.vocabularyModel
      .find({ moduleRefs: moduleRef })
      .sort({ word: 1 })
      .lean();

    const words = vocabularyItems.map(item => VocabularyMapper.toDto(item));

    if (!userId) {
      return { words };
    }

    // Get user progress for this module
    const progress = await this.getVocabularyProgressStats(moduleRef, userId);

    return { words, progress };
  }

  /**
   * Get vocabulary progress statistics for a user in a module
   */
  async getVocabularyProgressStats(moduleRef: string, userId: string): Promise<VocabularyProgressStats> {
    // Get all vocabulary items for the module
    const totalWords = await this.vocabularyModel.countDocuments({ moduleRefs: moduleRef });

    // Get user progress
    const progressData = await this.progressModel.aggregate([
      { $match: { userId, moduleRef } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      learned: 0,
      learning: 0,
      notStarted: 0
    };

    for (const item of progressData) {
      switch (item._id) {
        case 'learned':
          stats.learned = item.count;
          break;
        case 'learning':
          stats.learning = item.count;
          break;
        case 'not_started':
          stats.notStarted = item.count;
          break;
      }
    }

    const learnedWords = stats.learned;
    const learningWords = stats.learning;
    const notStartedWords = totalWords - learnedWords - learningWords;
    const progressPercentage = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;

    return {
      totalWords,
      learnedWords,
      learningWords,
      notStartedWords,
      progressPercentage
    };
  }

  /**
   * Mark a word as learned for a user
   */
  async markWordAsLearned(userId: string, moduleRef: string, wordId: string): Promise<UserVocabularyProgressType> {
    const progress = await this.progressModel.findOneAndUpdate(
      { userId, moduleRef, wordId },
      {
        $set: {
          status: 'learned',
          learnedAt: new Date(),
          lastStudiedAt: new Date()
        },
        $inc: { attempts: 1 }
      },
      { new: true, upsert: true }
    );

    return UserVocabularyProgressMapper.toDto(progress);
  }

  /**
   * Update word learning progress
   */
  async updateWordProgress(
    userId: string, 
    moduleRef: string, 
    wordId: string, 
    isCorrect: boolean, 
    timeSpent: number = 0
  ): Promise<UserVocabularyProgressType> {
    const updateData: any = {
      $set: {
        lastStudiedAt: new Date(),
        status: isCorrect ? 'learning' : 'not_started'
      },
      $inc: {
        attempts: 1,
        timeSpent,
        totalAttempts: 1,
        correctAttempts: isCorrect ? 1 : 0
      }
    };

    if (isCorrect) {
      updateData.$set.score = 0.8; // Set learning progress
    }

    const progress = await this.progressModel.findOneAndUpdate(
      { userId, moduleRef, wordId },
      updateData,
      { new: true, upsert: true }
    );

    return UserVocabularyProgressMapper.toDto(progress);
  }

  /**
   * Sync vocabulary from lessons to database
   */
  async syncModuleVocabulary(moduleRef: string): Promise<{ created: number; updated: number }> {
    const words = await this.extractWordsFromModule(moduleRef);
    let created = 0;
    let updated = 0;

    for (const word of words) {
      const existing = await this.vocabularyModel.findOne({ id: word.id });
      
      if (existing) {
        // Update existing word with new module reference
        await this.vocabularyModel.updateOne(
          { id: word.id },
          {
            $addToSet: {
              moduleRefs: { $each: word.moduleRefs || [] },
              lessonRefs: { $each: word.lessonRefs || [] }
            },
            $inc: { occurrenceCount: word.occurrenceCount || 0 }
          }
        );
        updated++;
      } else {
        // Create new word
        await this.vocabularyModel.create(word);
        created++;
      }
    }

    return { created, updated };
  }

  /**
   * Get user's vocabulary progress for a specific word
   */
  async getUserWordProgress(userId: string, moduleRef: string, wordId: string): Promise<UserVocabularyProgressType | null> {
    const progress = await this.progressModel.findOne({ userId, moduleRef, wordId }).lean();
    return progress ? UserVocabularyProgressMapper.toDto(progress) : null;
  }

  // ==========================================================================
  //  SRS / очередь повторений (Фаза 1 механики памяти)
  // ==========================================================================

  private normalizeText(s?: string): string {
    return (s || '').toString().trim().toLowerCase().replace(/[.,!?;:«»"']/g, '').replace(/\s+/g, ' ').trim();
  }

  private shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /**
   * Дневная очередь: созревшие повторения + немного новых атомов для ввода.
   * Атомы двух типов: слова (vocab_*) и грам-пробы (gram_*), в общей SRS-очереди.
   */
  async getReviewQueue(
    userId: string,
    opts?: { reviewLimit?: number; newLimit?: number },
    focus?: 'weak' | 'due',
  ): Promise<{ items: any[]; dueCount: number; newCount: number; focus: string }> {
    const now = new Date();
    const reviewLimit = Math.min(opts?.reviewLimit ?? 30, 60);
    const weakMode = focus === 'weak';
    // Атом «слабый» (западает): его повторно забывали или он даётся тяжело
    const WEAK_MATCH: any = { $or: [{ lapses: { $gte: 2 } }, { ease: { $lte: 2.0 } }] };
    const isWeak = (p: any) => (p?.lapses ?? 0) >= 2 || (p?.ease ?? 2.5) <= 2.0;

    // Источник тест-карточек: слабые (разбор ошибок) ИЛИ созревшие (со слабыми вперёд)
    let source: any[];
    if (weakMode) {
      source = await this.progressModel
        .find({ userId, status: { $in: ['learning', 'learned'] }, ...WEAK_MATCH })
        .sort({ lapses: -1, ease: 1 }).limit(reviewLimit).lean();
    } else {
      source = await this.progressModel
        .find({ userId, dueAt: { $lte: now }, status: { $in: ['learning', 'learned'] } })
        .sort({ dueAt: 1 }).limit(reviewLimit).lean();
      // адаптивность: слабые атомы — вперёд, пока внимание свежее
      source.sort((a, b) => (isWeak(b) ? 1 : 0) - (isWeak(a) ? 1 : 0));
    }

    const srcWordIds = source.map(p => p.wordId).filter(id => id.startsWith('vocab_'));
    const srcGramIds = source.map(p => p.wordId).filter(id => id.startsWith('gram_'));
    const dueVocab = await this.vocabularyModel.find({ id: { $in: srcWordIds } }).lean();
    const dueGram = await this.grammarModel.find({ id: { $in: srcGramIds } }).lean();
    const vById = new Map(dueVocab.map((v: any) => [v.id, v]));
    const gById = new Map(dueGram.map((g: any) => [g.id, g]));

    // дистракторы для слов
    const pool: Array<{ translation?: string }> = await this.vocabularyModel
      .aggregate([{ $sample: { size: 60 } }, { $project: { _id: 0, translation: 1 } }]);
    const poolTr = pool.map(p => p.translation).filter(Boolean) as string[];
    const buildOptions = (correct: string): string[] => {
      const set = new Set<string>([correct]);
      let guard = 0;
      while (set.size < 4 && guard++ < 200) {
        const cand = poolTr[Math.floor(Math.random() * poolTr.length)];
        if (cand && this.normalizeText(cand) !== this.normalizeText(correct)) set.add(cand);
      }
      return this.shuffle(Array.from(set));
    };

    // Ступень производства по силе памяти: окреп (≥2 подряд) → набор ответа самому, иначе — выбор
    const stageFor = (reps?: number): 'recognize' | 'recall' => ((reps ?? 0) >= 2 ? 'recall' : 'recognize');

    // тест-карточки (слабые/созревшие) в выбранном порядке
    const testCards = source.map(p => {
      const stage = stageFor((p as any).repetitions);
      if (vById.has(p.wordId)) {
        const v: any = vById.get(p.wordId);
        if (stage === 'recall') {
          // производство: показываем перевод, слово набирает пользователь (без вариантов)
          return { kind: 'word', stage, wordId: v.id, prompt: v.translation, isNew: false, mode: 'test' };
        }
        return {
          kind: 'word', stage, wordId: v.id, word: v.word, transcription: v.transcription, audioKey: v.audioKey,
          isNew: false, mode: 'test', options: buildOptions(v.translation || ''),
        };
      }
      if (gById.has(p.wordId)) {
        const g: any = gById.get(p.wordId);
        if (stage === 'recall') {
          return { kind: 'grammar', stage, wordId: g.id, title: g.title, prompt: g.prompt, handbookRef: g.handbookRef, isNew: false, mode: 'test' };
        }
        return {
          kind: 'grammar', stage, wordId: g.id, title: g.title, prompt: g.prompt, handbookRef: g.handbookRef,
          isNew: false, mode: 'test', options: this.shuffle([...(g.options || [])]),
        };
      }
      return null;
    }).filter(Boolean);

    // Новые атомы — только в обычном режиме и адаптивно к нагрузке
    const newInterleaved: any[] = [];
    if (!weakMode) {
      const [dueTotal, weakCount] = await Promise.all([
        this.progressModel.countDocuments({ userId, dueAt: { $lte: now }, status: { $in: ['learning', 'learned'] } }),
        this.progressModel.countDocuments({ userId, status: { $in: ['learning', 'learned'] }, ...WEAK_MATCH }),
      ]);
      // адаптивный темп: большой долг → 0 (консолидация); много слабых → меньше нового
      let nv = Math.min(opts?.newLimit ?? 6, 20);
      let ng = 3;
      if (dueTotal >= 20) { nv = 0; ng = 0; }
      else if (weakCount >= 10) { nv = 2; ng = 1; }

      if (nv > 0 || ng > 0) {
        const seen = await this.progressModel.distinct('wordId', { userId });
        // Новые атомы — ТОЛЬКО из пройденных уроков: SRS закрепляет курс,
        // а не заменяет его (и не отдаёт платный словарь бесплатно)
        const completedLessons: string[] = await this.lessonProgressModel.distinct('lessonRef', {
          userId: String(userId),
          status: 'completed',
        });
        const completedModules = Array.from(new Set(completedLessons.map((r) => r.split('.').slice(0, 2).join('.'))));
        const newVocab = nv > 0 && completedLessons.length
          ? await this.vocabularyModel.find({ id: { $nin: seen }, lessonRefs: { $in: completedLessons } }).sort({ occurrenceCount: -1 }).limit(nv).lean()
          : [];
        const newGram = ng > 0 && completedModules.length
          ? await this.grammarModel.find({ id: { $nin: seen }, moduleRefs: { $in: completedModules } }).sort({ level: 1 }).limit(ng).lean()
          : [];
        const teachVocab = newVocab.map((v: any) => ({
          kind: 'word', wordId: v.id, word: v.word, transcription: v.transcription, audioKey: v.audioKey,
          translation: v.translation, example: (v.examples || [])[0] || null, isNew: true, mode: 'teach',
        }));
        const teachGram = newGram.map((g: any) => ({
          kind: 'grammar', wordId: g.id, title: g.title, prompt: g.prompt, correctOption: g.options[g.correctIndex],
          explanation: g.explanation, handbookRef: g.handbookRef, isNew: true, mode: 'teach',
        }));
        const maxNew = Math.max(teachVocab.length, teachGram.length);
        for (let i = 0; i < maxNew; i++) {
          if (teachVocab[i]) newInterleaved.push(teachVocab[i]);
          if (teachGram[i]) newInterleaved.push(teachGram[i]);
        }
      }
    }

    const items = [...testCards, ...newInterleaved];
    return { items, dueCount: testCards.length, newCount: newInterleaved.length, focus: weakMode ? 'weak' : 'due' };
  }

  /** Обработка одного повторения/ввода атома (слово или грамматика): применяет SRS. */
  async submitReview(userId: string, wordId: string, body: { mode: 'teach' | 'test'; choice?: string; stage?: 'recognize' | 'recall' }): Promise<any> {
    const now = new Date();
    const prev = await this.progressModel.findOne({ userId, wordId }).lean();
    const isGrammar = wordId.startsWith('gram_');

    let correctAnswer = '';
    let explanation: string | undefined;
    let handbookRef: string | undefined;
    let example: any = null;
    let moduleRef = 'general';
    let word: string | undefined;
    let translation: string | undefined;

    if (isGrammar) {
      const g: any = await this.grammarModel.findOne({ id: wordId }).lean();
      if (!g) return { error: 'atom_not_found' };
      correctAnswer = g.options?.[g.correctIndex] ?? ''; // цель одна на обе ступени
      explanation = g.explanation;
      handbookRef = g.handbookRef;
      moduleRef = (g.moduleRefs && g.moduleRefs[0]) || 'grammar';
    } else {
      const v: any = await this.vocabularyModel.findOne({ id: wordId }).lean();
      if (!v) return { error: 'word_not_found' };
      word = v.word;
      translation = v.translation || '';
      example = (v.examples || [])[0] || null;
      moduleRef = (v.moduleRefs && v.moduleRefs[0]) || 'general';
      // recall = производство: цель — само слово (набирает пользователь); recognize = перевод
      correctAnswer = body.stage === 'recall' ? (v.word || '') : (v.translation || '');
    }

    let grade: Grade;
    let correct: boolean | undefined;
    if (body.mode === 'teach') {
      grade = 'good'; // ввод нового: первый интервал (1 день)
    } else {
      correct = this.normalizeText(body.choice) === this.normalizeText(correctAnswer);
      grade = correct ? 'good' : 'again';
    }

    const s = schedule(prev as any, grade, now);

    await this.progressModel.updateOne(
      { userId, wordId },
      {
        $set: {
          moduleRef, status: s.status, repetitions: s.repetitions, intervalDays: s.intervalDays,
          ease: s.ease, lapses: s.lapses, dueAt: s.dueAt, lastStudiedAt: now,
          ...(s.status === 'learned' ? { learnedAt: now } : {}),
          ...(prev ? {} : { introducedAt: now }),
        },
        $inc: { attempts: 1, totalAttempts: body.mode === 'test' ? 1 : 0, correctAttempts: correct ? 1 : 0 },
        $setOnInsert: { userId, wordId },
      },
      { upsert: true },
    );

    return {
      correct, grade, intervalDays: s.intervalDays, dueAt: s.dueAt, status: s.status,
      correctTranslation: correctAnswer, explanation, handbookRef, example, word, translation,
    };
  }

  /** Сводка для главной/шапки: сколько к повторению, доступно новых, в процессе, освоено (слова+грамматика). */
  async getReviewStats(userId: string): Promise<any> {
    const now = new Date();
    const [due, learning, learned, seen, vocabTotal, gramTotal, weak] = await Promise.all([
      this.progressModel.countDocuments({ userId, dueAt: { $lte: now }, status: { $in: ['learning', 'learned'] } }),
      this.progressModel.countDocuments({ userId, status: 'learning' }),
      this.progressModel.countDocuments({ userId, status: 'learned' }),
      this.progressModel.countDocuments({ userId }),
      this.vocabularyModel.estimatedDocumentCount(),
      this.grammarModel.estimatedDocumentCount(),
      this.progressModel.countDocuments({ userId, status: { $in: ['learning', 'learned'] }, $or: [{ lapses: { $gte: 2 } }, { ease: { $lte: 2.0 } }] }),
    ]);
    const total = vocabTotal + gramTotal;
    return { due, newAvailable: Math.max(0, total - seen), learning, learned, weak, activeVocab: learning + learned, totalVocab: total };
  }

  /**
   * Get comprehensive vocabulary statistics for a user
   * GET /vocabulary/stats
   */
  async getVocabularyStats(userId: string): Promise<VocabularyStatsResponseDto> {
    // Get all vocabulary items
    const allVocabulary = await this.vocabularyModel.find().lean();
    
    // Get all user progress records
    const userProgress = await this.progressModel.find({ userId }).lean();
    
    // Create maps for efficient lookup
    const progressMap = new Map<string, typeof userProgress[0]>();
    for (const p of userProgress) {
      progressMap.set(p.wordId, p);
    }

    // Build word map for easy lookup
    const wordMap = new Map<string, typeof allVocabulary[0]>();
    for (const word of allVocabulary) {
      wordMap.set(word.id, word);
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(allVocabulary, progressMap);

    // Calculate statistics by difficulty
    const byDifficulty = this.calculateByDifficulty(allVocabulary, progressMap, userProgress);

    // Calculate statistics by category (using tags)
    const byCategory = this.calculateByCategory(allVocabulary, progressMap, userId);

    // Calculate statistics by part of speech
    const byPartOfSpeech = this.calculateByPartOfSpeech(allVocabulary, progressMap);

    // Get recent activity
    const recentActivity = await this.getRecentActivity(userId, wordMap);

    // Get streak information from user document
    const streak = await this.getStreakInfo(userId, userProgress);

    // Get weekly progress
    const weeklyProgress = this.calculateWeeklyProgress(userProgress);

    return {
      summary,
      byDifficulty,
      byCategory,
      byPartOfSpeech,
      recentActivity,
      streak,
      weeklyProgress,
    };
  }

  private calculateSummary(
    vocabulary: any[],
    progressMap: Map<string, any>
  ): VocabularySummaryDto {
    let learned = 0;
    let learning = 0;

    for (const word of vocabulary) {
      const progress = progressMap.get(word.id);
      if (progress) {
        if (progress.status === 'learned') learned++;
        else if (progress.status === 'learning') learning++;
      }
    }

    const total = vocabulary.length;
    const notStarted = total - learned - learning;
    const learnedPercentage = total > 0 
      ? Math.round((learned / total) * 1000) / 10 
      : 0;

    return { learned, learning, notStarted, total, learnedPercentage };
  }

  private calculateByDifficulty(
    vocabulary: any[],
    progressMap: Map<string, any>,
    _userProgress: any[]
  ): VocabularyByDifficultyDto {
    const calculateForDifficulty = (difficulty: 'easy' | 'medium' | 'hard'): VocabularyDifficultyStatsDto => {
      const wordsOfDifficulty = vocabulary.filter(w => (w.difficulty || 'easy') === difficulty);
      let learned = 0;
      let learning = 0;
      let totalTimeSpent = 0;
      let learnedCount = 0;

      for (const word of wordsOfDifficulty) {
        const progress = progressMap.get(word.id);
        if (progress) {
          if (progress.status === 'learned') {
            learned++;
            if (progress.timeSpent) {
              totalTimeSpent += progress.timeSpent;
              learnedCount++;
            }
          } else if (progress.status === 'learning') {
            learning++;
          }
        }
      }

      const total = wordsOfDifficulty.length;
      const notStarted = total - learned - learning;
      const learnedPercentage = total > 0 
        ? Math.round((learned / total) * 1000) / 10 
        : 0;
      
      const averageTimeToLearn = learnedCount > 0 
        ? Math.round((totalTimeSpent / learnedCount / 60) * 10) / 10 // convert seconds to minutes
        : undefined;

      return {
        learned,
        learning,
        notStarted,
        total,
        learnedPercentage,
        averageTimeToLearn,
      };
    };

    return {
      easy: calculateForDifficulty('easy'),
      medium: calculateForDifficulty('medium'),
      hard: calculateForDifficulty('hard'),
    };
  }

  private calculateByCategory(
    vocabulary: any[],
    progressMap: Map<string, any>,
    _userId: string
  ): Record<string, VocabularyCategoryStatsDto> {
    const categoryStats: Record<string, { learned: number; learning: number; total: number; wordIds: string[] }> = {};

    // Group words by category (from moduleRefs or tags)
    for (const word of vocabulary) {
      const categories = new Set<string>();
      
      // Extract category from moduleRefs (e.g., "a0.travel" -> "travel")
      if (word.moduleRefs) {
        for (const moduleRef of word.moduleRefs) {
          const parts = moduleRef.split('.');
          if (parts.length > 1) {
            categories.add(parts[1].split('_')[0]); // e.g., "travel_basics" -> "travel"
          }
        }
      }
      
      // Also use tags as categories
      if (word.tags) {
        for (const tag of word.tags) {
          categories.add(tag.toLowerCase());
        }
      }

      // If no categories found, use "common"
      if (categories.size === 0) {
        categories.add('common');
      }

      for (const category of categories) {
        if (!categoryStats[category]) {
          categoryStats[category] = { learned: 0, learning: 0, total: 0, wordIds: [] };
        }
        
        categoryStats[category].total++;
        categoryStats[category].wordIds.push(word.id);
        
        const progress = progressMap.get(word.id);
        if (progress) {
          if (progress.status === 'learned') categoryStats[category].learned++;
          else if (progress.status === 'learning') categoryStats[category].learning++;
        }
      }
    }

    // Convert to response format
    const result: Record<string, VocabularyCategoryStatsDto> = {};
    
    for (const [categoryKey, stats] of Object.entries(categoryStats)) {
      const notStarted = stats.total - stats.learned - stats.learning;
      const learnedPercentage = stats.total > 0 
        ? Math.round((stats.learned / stats.total) * 1000) / 10 
        : 0;

      // Determine priority based on progress and category importance
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (learnedPercentage < 30 && stats.total > 5) {
        priority = 'high';
      } else if (learnedPercentage >= 70) {
        priority = 'low';
      }

      result[categoryKey] = {
        categoryKey,
        categoryName: CATEGORY_NAMES[categoryKey] || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
        learned: stats.learned,
        learning: stats.learning,
        notStarted,
        total: stats.total,
        learnedPercentage,
        priority,
      };
    }

    return result;
  }

  private calculateByPartOfSpeech(
    vocabulary: any[],
    progressMap: Map<string, any>
  ): Record<string, VocabularyPartOfSpeechStatsDto> {
    const posStats: Record<string, { learned: number; total: number }> = {};

    for (const word of vocabulary) {
      const partOfSpeech = word.partOfSpeech || 'unknown';
      
      if (!posStats[partOfSpeech]) {
        posStats[partOfSpeech] = { learned: 0, total: 0 };
      }
      
      posStats[partOfSpeech].total++;
      
      const progress = progressMap.get(word.id);
      if (progress && progress.status === 'learned') {
        posStats[partOfSpeech].learned++;
      }
    }

    const result: Record<string, VocabularyPartOfSpeechStatsDto> = {};
    
    for (const [pos, stats] of Object.entries(posStats)) {
      const learnedPercentage = stats.total > 0 
        ? Math.round((stats.learned / stats.total) * 1000) / 10 
        : 0;

      result[pos] = {
        partOfSpeech: pos,
        learned: stats.learned,
        total: stats.total,
        learnedPercentage,
      };
    }

    return result;
  }

  private async getRecentActivity(
    userId: string,
    wordMap: Map<string, any>
  ): Promise<VocabularyRecentActivityDto[]> {
    // Get recent progress updates sorted by lastStudiedAt
    const recentProgress = await this.progressModel
      .find({ userId })
      .sort({ lastStudiedAt: -1 })
      .limit(20)
      .lean();

    const activities: VocabularyRecentActivityDto[] = [];

    for (const progress of recentProgress) {
      if (!progress.lastStudiedAt) continue;

      const word = wordMap.get(progress.wordId);
      if (!word) continue;

      // Determine action based on status and recent change
      let action: 'learned' | 'reviewed' | 'forgot' = 'reviewed';
      if (progress.status === 'learned' && progress.learnedAt) {
        // If learnedAt is close to lastStudiedAt, it was learned
        const learnedTime = new Date(progress.learnedAt).getTime();
        const studiedTime = new Date(progress.lastStudiedAt).getTime();
        if (Math.abs(learnedTime - studiedTime) < 60000) { // within 1 minute
          action = 'learned';
        }
      } else if (progress.status === 'not_started') {
        action = 'forgot';
      }

      activities.push({
        id: `activity_${progress.wordId}_${new Date(progress.lastStudiedAt).getTime()}`,
        wordId: progress.wordId,
        word: word.word,
        action,
        timestamp: new Date(progress.lastStudiedAt).toISOString(),
        difficulty: word.difficulty || 'easy',
        timeSpent: progress.timeSpent || 0,
        score: action === 'reviewed' && progress.correctAttempts && progress.totalAttempts
          ? Math.round((progress.correctAttempts / progress.totalAttempts) * 100)
          : undefined,
      });
    }

    return activities;
  }

  private async getStreakInfo(
    userId: string,
    userProgress: any[]
  ): Promise<VocabularyStreakDto> {
    // Try to get streak from user document
    const user = await this.userModel.findOne({ userId }).lean();
    
    // Find the most recent learning activity
    let lastLearnedAt: string | undefined;
    for (const progress of userProgress) {
      if (progress.lastStudiedAt) {
        if (!lastLearnedAt || new Date(progress.lastStudiedAt) > new Date(lastLearnedAt)) {
          lastLearnedAt = new Date(progress.lastStudiedAt).toISOString();
        }
      }
    }

    return {
      current: user?.streak?.current || 0,
      longest: user?.streak?.longest || 0,
      lastLearnedAt,
    };
  }

  private calculateWeeklyProgress(userProgress: any[]): VocabularyWeeklyProgressDto[] {
    const weeklyData: Record<string, { learned: number; reviewed: number; totalTimeSpent: number }> = {};

    for (const progress of userProgress) {
      if (!progress.lastStudiedAt) continue;

      const date = new Date(progress.lastStudiedAt);
      const year = date.getFullYear();
      const week = this.getWeekNumber(date);
      const weekKey = `${year}-${week.toString().padStart(2, '0')}`;

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { learned: 0, reviewed: 0, totalTimeSpent: 0 };
      }

      if (progress.status === 'learned' && progress.learnedAt) {
        const learnedDate = new Date(progress.learnedAt);
        const learnedWeek = `${learnedDate.getFullYear()}-${this.getWeekNumber(learnedDate).toString().padStart(2, '0')}`;
        if (learnedWeek === weekKey) {
          weeklyData[weekKey].learned++;
        } else {
          weeklyData[weekKey].reviewed++;
        }
      } else {
        weeklyData[weekKey].reviewed++;
      }

      // Add time spent in minutes
      weeklyData[weekKey].totalTimeSpent += Math.round((progress.timeSpent || 0) / 60);
    }

    // Convert to array and sort by week descending
    return Object.entries(weeklyData)
      .map(([week, data]) => ({
        week,
        learned: data.learned,
        reviewed: data.reviewed,
        totalTimeSpent: data.totalTimeSpent,
      }))
      .sort((a, b) => b.week.localeCompare(a.week))
      .slice(0, 12); // Return last 12 weeks
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Helper methods
  private generateWordId(word: string, moduleRef?: string): string {
    const sanitize = (value: string): string =>
      value
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const buildPart = (value: string): string => {
      const sanitized = sanitize(value);
      return sanitized || Buffer.from(value).toString('hex').toLowerCase();
    };

    const parts: string[] = [];
    if (moduleRef) {
      parts.push(buildPart(moduleRef));
    }
    parts.push(buildPart(word));

    return parts.join('__');
  }

  private generateAudioKey(lessonRef: string, taskRef: string, word: string): string {
    return `${lessonRef}.${taskRef}.${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  private determineDifficulty(word: string): 'easy' | 'medium' | 'hard' {
    const length = word.length;
    const hasSpecialChars = /[^a-zA-Z\s]/.test(word);
    
    if (length <= 4 && !hasSpecialChars) return 'easy';
    if (length <= 8 && !hasSpecialChars) return 'medium';
    return 'hard';
  }

  private extractTagsFromLesson(lesson: any): string[] {
    const tags = (lesson.tags || []) as string[];
    if (lesson.type) tags.push(lesson.type);
    return [...new Set(tags)]; // Remove duplicates
  }
}
