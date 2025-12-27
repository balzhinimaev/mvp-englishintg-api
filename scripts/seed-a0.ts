/**
 * A0 Content Seeder
 * 
 * Loads A0 module data from JSON seeds into MongoDB
 * Validates all data using class-validator before insertion
 * 
 * Usage:
 *   ts-node scripts/seed-a0.ts --dry-run    # preview without changes
 *   ts-node scripts/seed-a0.ts --apply      # apply changes
 */

import 'dotenv/config';
import mongoose, { ClientSession } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

// Import schemas and DTOs
import { CourseModule, CourseModuleSchema } from '../src/modules/common/schemas/course-module.schema';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';
import { TaskDto } from '../src/modules/content/dto/task-data.dto';
import { MultilingualText, OptionalMultilingualText } from '../src/modules/common/utils/i18n.util';

// Types for seed data
interface ModuleSeed {
  moduleRef: string;
  level: 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  title: MultilingualText;
  description?: OptionalMultilingualText;
  tags: string[];
  order: number;
  published: boolean;
  requiresPro: boolean;
  isAvailable: boolean;
}

interface LessonSeed {
  moduleRef: string;
  lessonRef: string;
  title: MultilingualText;
  description?: OptionalMultilingualText;
  order: number;
  estimatedMinutes: number;
  type: 'conversation' | 'vocabulary' | 'grammar';
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  xpReward: number;
  hasAudio: boolean;
  hasVideo: boolean;
  previewText: string;
  published: boolean;
  tasks: any[];
}

interface ContentSeed {
  module: ModuleSeed;
  lessons: LessonSeed[];
}

// CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');

if (!DRY_RUN && !APPLY) {
  console.log('Usage: ts-node scripts/seed-a0.ts [--dry-run | --apply]');
  process.exit(1);
}

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'englishintg';

// Models
let CourseModuleModel: mongoose.Model<CourseModule>;
let LessonModel: mongoose.Model<Lesson>;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
    });
    
    CourseModuleModel = mongoose.model('CourseModule', CourseModuleSchema);
    LessonModel = mongoose.model('Lesson', LessonSchema);
    
    console.log(`✅ Connected to MongoDB: ${MONGODB_DB_NAME}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function validateTasks(tasks: any[]): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    try {
      const taskDto = plainToClass(TaskDto, task);
      const validationErrors = await validate(taskDto);
      
      if (validationErrors.length > 0) {
        errors.push(`Task ${i + 1} (${task.ref}): ${validationErrors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ')}`);
      }
    } catch (error) {
      errors.push(`Task ${i + 1} (${task.ref}): Validation failed - ${error}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

async function loadSeedData(filePath: string): Promise<ContentSeed> {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Seed file not found: ${fullPath}`);
  }
  
  const rawData = fs.readFileSync(fullPath, 'utf-8');
  const seedData = JSON.parse(rawData) as ContentSeed;
  
  console.log(`📖 Loaded seed data: ${seedData.module.moduleRef} (${seedData.lessons.length} lessons)`);
  return seedData;
}

async function seedModule(moduleSeed: ModuleSeed, session: ClientSession | null = null): Promise<void> {
  const existingModule = await CourseModuleModel.findOne({ moduleRef: moduleSeed.moduleRef }).session(session);
  
  if (existingModule) {
    console.log(`🔄 Module already exists: ${moduleSeed.moduleRef}`);
    if (!DRY_RUN) {
      await CourseModuleModel.updateOne(
        { moduleRef: moduleSeed.moduleRef },
        { $set: moduleSeed }
      ).session(session);
      console.log(`✅ Updated module: ${moduleSeed.moduleRef}`);
    }
  } else {
    console.log(`➕ Creating new module: ${moduleSeed.moduleRef}`);
    if (!DRY_RUN) {
      await CourseModuleModel.create([moduleSeed], { session });
      console.log(`✅ Created module: ${moduleSeed.moduleRef}`);
    }
  }
}

async function seedLesson(lessonSeed: LessonSeed, session: ClientSession | null = null): Promise<void> {
  // Validate tasks first
  console.log(`🔍 Validating ${lessonSeed.tasks.length} tasks for lesson ${lessonSeed.lessonRef}`);
  const taskValidation = await validateTasks(lessonSeed.tasks);
  
  if (!taskValidation.valid) {
    console.error(`❌ Task validation failed for lesson ${lessonSeed.lessonRef}:`);
    taskValidation.errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Task validation failed for lesson ${lessonSeed.lessonRef}`);
  }
  
  console.log(`✅ All tasks validated for lesson ${lessonSeed.lessonRef}`);
  
  const existingLesson = await LessonModel.findOne({ lessonRef: lessonSeed.lessonRef }).session(session);
  
  if (existingLesson) {
    console.log(`🔄 Lesson already exists: ${lessonSeed.lessonRef}`);
    if (!DRY_RUN) {
      await LessonModel.updateOne(
        { lessonRef: lessonSeed.lessonRef },
        { $set: lessonSeed }
      ).session(session);
      console.log(`✅ Updated lesson: ${lessonSeed.lessonRef} (${lessonSeed.tasks.length} tasks)`);
    }
  } else {
    console.log(`➕ Creating new lesson: ${lessonSeed.lessonRef}`);
    if (!DRY_RUN) {
      await LessonModel.create([lessonSeed], { session });
      console.log(`✅ Created lesson: ${lessonSeed.lessonRef} (${lessonSeed.tasks.length} tasks)`);
    }
  }
}

async function seedContentFile(filePath: string): Promise<void> {
  console.log(`\n🌱 Seeding content from: ${filePath}`);
  
  const seedData = await loadSeedData(filePath);
  
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // First seed the module
      await seedModule(seedData.module, session);
      
      // Then seed all lessons
      for (const lesson of seedData.lessons) {
        await seedLesson(lesson, session);
      }
    });
    
    console.log(`✅ Successfully seeded: ${seedData.module.moduleRef}`);
    
  } catch (error) {
    console.error(`❌ Error seeding ${filePath}:`, error);
    throw error;
  } finally {
    await session.endSession();
  }
}

async function main() {
  console.log(`\n🚀 A0 Content Seeder`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'APPLY (will modify database)'}`);
  
  await connectDB();
  
  try {
    // Seed A0 modules
    const seedFiles = [
      'content/seeds/a0-basics.json',
      'content/seeds/a0-travel.json'
    ];
    
    for (const seedFile of seedFiles) {
      await seedContentFile(seedFile);
    }
    
    console.log(`\n🎉 Seeding completed successfully!`);
    
    // Summary
    const moduleCount = await CourseModuleModel.countDocuments({ level: 'A0' });
    const lessonCount = await LessonModel.countDocuments({ moduleRef: /^a0\./ });
    
    console.log(`\n📊 A0 Content Summary:`);
    console.log(`  - Modules: ${moduleCount}`);
    console.log(`  - Lessons: ${lessonCount}`);
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as seedA0Content };
