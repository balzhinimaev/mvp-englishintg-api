import 'dotenv/config';
import mongoose from 'mongoose';
import { CourseModule, CourseModuleSchema } from '../src/modules/common/schemas/course-module.schema';
import { Lesson, LessonSchema } from '../src/modules/common/schemas/lesson.schema';

async function main() {
  const uri = process.env.MONGODB_URI || '';
  const dbName = process.env.MONGODB_DB_NAME || 'englishintg';
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri, { dbName });
  const ModuleModel = mongoose.model('CourseModule', CourseModuleSchema, 'course_modules');
  const LessonModel = mongoose.model('Lesson', LessonSchema, 'lessons');

  const modules = await ModuleModel.find({}).exec();
  for (const m of modules as any[]) {
    if (!m.moduleRef) m.moduleRef = m.ref || `${(m.level||'a0').toLowerCase()}.module-${m._id.toString().slice(-4)}`;
    if (!m.level) m.level = m.levelMin || 'A0';
    if (typeof m.published !== 'boolean') m.published = m.status === 'published';
    if (typeof m.order !== 'number') m.order = m.order ?? 0;
    await m.save();
  }

  const lessons = await LessonModel.find({}).exec();
  for (const l of lessons as any[]) {
    if (!l.lessonRef) l.lessonRef = l.ref || `${l.moduleRef || 'a0.unknown'}.001`;
    if (!l.moduleRef) {
      const parts = String(l.lessonRef).split('.');
      l.moduleRef = parts.slice(0,2).join('.');
    }
    if (typeof l.published !== 'boolean') l.published = l.status === 'published';
    if (!l.estimatedMinutes) l.estimatedMinutes = Math.max(1, Math.ceil((l.estimatedSec ?? 600)/60));
    await l.save();
  }

  // Create indexes (drop existing if they have different options)
  // Handle moduleRef index
  try {
    // Try to drop existing index if it exists (ignore if not found)
    try {
      await ModuleModel.collection.dropIndex('moduleRef_1');
      console.log('Dropped existing moduleRef_1 index');
    } catch (dropError: any) {
      if (dropError.code !== 27) { // 27 = IndexNotFound
        throw dropError;
      }
    }
    // Create index with correct options
    await ModuleModel.collection.createIndex({ moduleRef: 1 }, { unique: true, sparse: true });
    console.log('Created moduleRef index');
  } catch (e: any) {
    if (e.code === 85 || e.code === 86) {
      // IndexOptionsConflict or IndexKeySpecsConflict - index already exists with correct options
      console.log('moduleRef index already exists with correct options');
    } else {
      throw e;
    }
  }

  // Handle lessonRef index
  try {
    // Try to drop existing index if it exists (ignore if not found)
    try {
      await LessonModel.collection.dropIndex('lessonRef_1');
      console.log('Dropped existing lessonRef_1 index');
    } catch (dropError: any) {
      if (dropError.code !== 27) { // 27 = IndexNotFound
        throw dropError;
      }
    }
    // Create index with correct options
    await LessonModel.collection.createIndex({ lessonRef: 1 }, { unique: true, sparse: true });
    console.log('Created lessonRef index');
  } catch (e: any) {
    if (e.code === 85 || e.code === 86) {
      // IndexOptionsConflict or IndexKeySpecsConflict - index already exists with correct options
      console.log('lessonRef index already exists with correct options');
    } else {
      throw e;
    }
  }

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log('Migration completed');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


