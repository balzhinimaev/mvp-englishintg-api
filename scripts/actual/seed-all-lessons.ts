#!/usr/bin/env ts-node
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONTENT_DIR = path.join(__dirname, 'content');

/**
 * Рекурсивно находит все lessons.json файлы и извлекает moduleRef из пути
 */
function findAllModules(): string[] {
  const modules: string[] = [];
  
  const levels = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const level of levels) {
    const levelPath = path.join(CONTENT_DIR, level);
    const moduleDirs = fs.readdirSync(levelPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const moduleDir of moduleDirs) {
      const lessonsFile = path.join(levelPath, moduleDir, 'lessons.json');
      if (fs.existsSync(lessonsFile)) {
        modules.push(moduleDir);
      }
    }
  }

  return modules.sort();
}

(async () => {
  console.log('🔍 Поиск всех модулей с lessons.json...\n');
  
  const modules = findAllModules();
  
  if (modules.length === 0) {
    console.log('❗️ Не найдено модулей с lessons.json');
    return;
  }

  console.log(`📦 Найдено модулей: ${modules.length}`);
  console.log(modules.map(m => `  - ${m}`).join('\n'));
  console.log();

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ module: string; error: string }> = [];

  for (let i = 0; i < modules.length; i++) {
    const moduleRef = modules[i];
    console.log(`\n[${i + 1}/${modules.length}] 📝 Засидирование ${moduleRef}...`);
    
    try {
      // Запускаем seed-lessons.ts для каждого модуля
      const scriptPath = path.join(__dirname, 'seed-lessons.ts');
      execSync(`ts-node "${scriptPath}" ${moduleRef}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '../..'),
      });
      successCount++;
    } catch (error) {
      errorCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ module: moduleRef, error: errorMsg });
      console.error(`❌ Ошибка при засидировании ${moduleRef}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 ИТОГИ:');
  console.log(`  ✅ Успешно: ${successCount}`);
  console.log(`  ❌ Ошибок: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Модули с ошибками:');
    errors.forEach(({ module, error }) => {
      console.log(`  - ${module}: ${error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 Все модули успешно засидированы!');
  }
})().catch(error => {
  console.error('❌ Критическая ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});

