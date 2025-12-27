/**
 * Vocabulary extraction script
 * Extracts vocabulary words from existing lessons and creates vocabulary database entries
 * 
 * Supported task types:
 * - flashcard: extracts word pairs (front/back)
 * - matching: extracts word pairs (left/right)
 * - multiple_choice: extracts English words from options
 * - choice: extracts English words from options
 * - gap: extracts English words from text
 * 
 * Words without translations will have empty translation field
 * and can be filled later with a translation script
 * 
 * Usage examples:
 *   ts-node scripts/extract-vocabulary.ts --dry
 *   ts-node scripts/extract-vocabulary.ts --apply
 *   ts-node scripts/extract-vocabulary.ts --apply --module=a0.travel
 *   ts-node scripts/extract-vocabulary.ts --apply --all-modules
 *   ts-node scripts/extract-vocabulary.ts --stats
 * 
 * Env:
 *   MONGODB_URI (required)
 *   MONGODB_DB_NAME (default: englishintg)
 */

import 'dotenv/config';
import mongoose, { ClientSession } from 'mongoose';
import { VocabularyItem, VocabularySchema } from '../src/modules/common/schemas/vocabulary.schema';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';
import { CourseModule, CourseModuleSchema } from '../src/modules/common/schemas/course-module.schema';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry');
const isApply = args.includes('--apply');
const isStats = args.includes('--stats');
const allModules = args.includes('--all-modules');
const moduleArg = args.find(arg => arg.startsWith('--module='))?.split('=')[1];

if (!isDryRun && !isApply && !isStats) {
  console.error('❌ Please specify --dry, --apply, or --stats');
  process.exit(1);
}

// Database connection
const MONGODB_URI = <string>process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'englishintg';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Vocabulary extraction logic
class VocabularyExtractor {
  private vocabularyModel = mongoose.model('VocabularyItem', VocabularySchema);
  private lessonModel = mongoose.model('Lesson', LessonSchema);
  private moduleModel = mongoose.model('CourseModule', CourseModuleSchema);

  /**
   * Extract vocabulary words from lessons in a module
   */
  async extractWordsFromModule(moduleRef: string): Promise<VocabularyItem[]> {
    console.log(`📚 Extracting vocabulary from module: ${moduleRef}`);

    // Get all lessons in the module
    const lessons = await this.lessonModel
      .find({ moduleRef, published: true })
      .lean();

    if (lessons.length === 0) {
      console.log(`⚠️  No published lessons found for module: ${moduleRef}`);
      return [];
    }

    console.log(`📖 Found ${lessons.length} lessons in module ${moduleRef}`);

    const wordMap = new Map<string, VocabularyItem>();

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
                  occurrenceCount: 0,
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

        // Extract words from multiple choice tasks (English options)
        if (task.type === 'multiple_choice' && task.data?.options) {
          for (const option of task.data.options) {
            if (option && this.isEnglishWord(option)) {
              const wordId = this.generateWordId(option, moduleRef);
              
              if (!wordMap.has(wordId)) {
                wordMap.set(wordId, {
                  id: wordId,
                  word: option,
                  translation: '', // Will be filled later by translation script
                  examples: [],
                  audioKey: this.generateAudioKey(lesson.lessonRef, task.ref, option),
                  difficulty: this.determineDifficulty(option),
                  tags: this.extractTagsFromLesson(lesson),
                  lessonRefs: [],
                  moduleRefs: [moduleRef],
                  occurrenceCount: 0,
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

        // Extract words from choice tasks (English options)
        if (task.type === 'choice' && task.data?.options) {
          for (const option of task.data.options) {
            if (option && this.isEnglishWord(option)) {
              const wordId = this.generateWordId(option, moduleRef);
              
              if (!wordMap.has(wordId)) {
                wordMap.set(wordId, {
                  id: wordId,
                  word: option,
                  translation: '', // Will be filled later by translation script
                  examples: [],
                  audioKey: this.generateAudioKey(lesson.lessonRef, task.ref, option),
                  difficulty: this.determineDifficulty(option),
                  tags: this.extractTagsFromLesson(lesson),
                  lessonRefs: [],
                  moduleRefs: [moduleRef],
                  occurrenceCount: 0,
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

        // Extract words from gap tasks (English text)
        if (task.type === 'gap' && task.data?.text) {
          const englishWords = this.extractEnglishWordsFromText(task.data.text);
          for (const word of englishWords) {
            const wordId = this.generateWordId(word, moduleRef);
            
            if (!wordMap.has(wordId)) {
              wordMap.set(wordId, {
                id: wordId,
                word: word,
                translation: '', // Will be filled later by translation script
                examples: [],
                audioKey: this.generateAudioKey(lesson.lessonRef, task.ref, word),
                difficulty: this.determineDifficulty(word),
                tags: this.extractTagsFromLesson(lesson),
                lessonRefs: [],
                moduleRefs: [moduleRef],
                occurrenceCount: 0
              });
            }

            const wordObj = wordMap.get(wordId)!;
            if (!wordObj.lessonRefs!.includes(lesson.lessonRef)) {
              wordObj.lessonRefs!.push(lesson.lessonRef);
            }
            wordObj.occurrenceCount!++;
          }
        }
      }
    }

    const words = Array.from(wordMap.values());
    console.log(`✨ Extracted ${words.length} unique words from module ${moduleRef}`);
    
    return words;
  }

  /**
   * Sync vocabulary to database
   */
  async syncVocabularyToDatabase(words: VocabularyItem[], session: ClientSession): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const word of words) {
      const existing = await this.vocabularyModel.findOne({ id: word.id }).session(session);
      
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
          },
          { session }
        );
        updated++;
      } else {
        // Create new word
        await this.vocabularyModel.create([word], { session });
        created++;
      }
    }

    return { created, updated };
  }

  /**
   * Get all modules
   */
  async getAllModules(): Promise<string[]> {
    const modules = await this.moduleModel
      .find({ published: true })
      .select('moduleRef')
      .lean();
    
    return modules.map(m => m.moduleRef);
  }

  /**
   * Get vocabulary statistics
   */
  async getVocabularyStats(): Promise<void> {
    const totalWords = await this.vocabularyModel.countDocuments();
    const wordsByModule = await this.vocabularyModel.aggregate([
      { $unwind: '$moduleRefs' },
      { $group: { _id: '$moduleRefs', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Vocabulary Statistics:');
    console.log(`Total unique words: ${totalWords}`);
    console.log('\nWords by module:');
    wordsByModule.forEach(item => {
      console.log(`  ${item._id}: ${item.count} words`);
    });
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
    return Array.from(new Set(tags)); // Remove duplicates
  }

  /**
   * Check if a string is likely an English word
   */
  private isEnglishWord(text: string): boolean {
    // Basic heuristics to detect English words
    const trimmed = text.trim();
    
    // Skip empty strings, very long texts, or texts with spaces (likely phrases)
    if (!trimmed || trimmed.length > 50 || trimmed.includes(' ')) {
      return false;
    }
    
    // Skip if contains only numbers or special characters
    if (!/^[a-zA-Z]/.test(trimmed)) {
      return false;
    }
    
    // Skip if contains Cyrillic characters (likely Russian)
    if (/[а-яё]/i.test(trimmed)) {
      return false;
    }
    
    // Skip common Russian words that might appear in options
    const russianWords = ['да', 'нет', 'может', 'быть', 'это', 'то', 'как', 'что', 'где', 'когда'];
    if (russianWords.includes(trimmed.toLowerCase())) {
      return false;
    }
    
    // If it contains only Latin letters and is reasonable length, consider it English
    return /^[a-zA-Z\s\-']+$/.test(trimmed) && trimmed.length >= 2;
  }

  /**
   * Extract English words from text (for gap tasks)
   */
  private extractEnglishWordsFromText(text: string): string[] {
    if (!text) return [];
    
    // Split text into words, removing punctuation
    const words = text.split(/\s+/)
      .map(word => word.replace(/[^\w'-]/g, ''))
      .filter(word => word.length > 0);
    
    // Filter for English words
    return words.filter(word => this.isEnglishWord(word));
  }
}

// Main execution
async function main() {
  await connectDB();

  const extractor = new VocabularyExtractor();

  try {
    if (isStats) {
      await extractor.getVocabularyStats();
      return;
    }

    let modulesToProcess: string[] = [];

    if (allModules) {
      modulesToProcess = await extractor.getAllModules();
      console.log(`📋 Processing all modules: ${modulesToProcess.join(', ')}`);
    } else if (moduleArg) {
      modulesToProcess = [moduleArg];
      console.log(`📋 Processing module: ${moduleArg}`);
    } else {
      console.error('❌ Please specify --module=moduleRef or --all-modules');
      process.exit(1);
    }

    if (isDryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
      
      for (const moduleRef of modulesToProcess) {
        const words = await extractor.extractWordsFromModule(moduleRef);
        
        console.log(`\n📝 Words that would be created/updated for ${moduleRef}:`);
        words.forEach(word => {
          console.log(`  - ${word.word} → ${word.translation} (${word.difficulty}, ${word.occurrenceCount} occurrences)`);
        });
      }
    }

    if (isApply) {
      console.log('\n💾 APPLY MODE - Changes will be saved to database\n');
      
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          let totalCreated = 0;
          let totalUpdated = 0;

          for (const moduleRef of modulesToProcess) {
            const words = await extractor.extractWordsFromModule(moduleRef);
            
            if (words.length > 0) {
              const { created, updated } = await extractor.syncVocabularyToDatabase(words, session);
              totalCreated += created;
              totalUpdated += updated;
              
              console.log(`✅ Module ${moduleRef}: ${created} created, ${updated} updated`);
            }
          }

          console.log(`\n🎉 Total: ${totalCreated} words created, ${totalUpdated} words updated`);
        });
      } finally {
        await session.endSession();
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the script
main().catch(console.error);
