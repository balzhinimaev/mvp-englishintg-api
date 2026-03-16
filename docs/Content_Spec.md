# A0 Content Specification & Seeding Guide

## Overview

This document describes the A0 level content specification, seeding procedures, and quality standards for the BurLive English learning platform.

## Content Architecture

### Module Structure
```typescript
{
  moduleRef: "a0.basics",          // Unique identifier
  level: "A0",                     // CEFR level  
  title: {                         // Multilingual
    en: "English Basics",
    ru: "Основы английского"
  },
  order: 1,                        // Display order
  requiresPro: false,              // Free for A0
  tags: ["basics", "foundation"]   // Searchable tags
}
```

### Lesson Structure
```typescript
{
  lessonRef: "a0.basics.001",      // Module.sequence
  moduleRef: "a0.basics",          // Parent module
  order: 1,                        // Within module
  estimatedMinutes: 8,             // 5-20 for A0
  type: "vocabulary",              // conversation|vocabulary|grammar
  difficulty: "easy",              // Always easy for A0
  xpReward: 25,                    // Standard reward
  hasAudio: true,                  // Audio content flag
  tasks: [...]                     // 6-10 tasks per lesson
}
```

### Task Types

> Canonical API contract and migration notes: `docs/task-contract-v2.1.md`

#### 1. Flashcard (`flashcard`)
```typescript
{
  ref: "a0.basics.001.t1",
  type: "flashcard",
  data: {
    front: "Hello",                // English word/phrase
    back: "Привет",               // Russian translation
    example: "Hello, my name is John.",
    audioKey: "a0.basics.001.t1.hello"  // TTS reference
  }
}
```

#### 2. Multiple Choice (`multiple_choice`)
```typescript
{
  ref: "a0.basics.001.t2",
  type: "multiple_choice", 
  data: {
    question: "Как сказать 'Привет' по-английски?",
    options: ["Hello", "Goodbye", "Thank you", "Please"],
    correctIndex: 0,
    explanation: "'Hello' — универсальное приветствие."
  }
}
```

#### 3. Listening (`listening`)
```typescript
{
  ref: "a0.basics.001.t3",
  type: "listening",
  data: {
    audioKey: "a0.basics.001.t3.hello",
    question: "Что вы услышали?",
    transcript: "Hello",
    translation: "Привет"
  }
}
```

#### 4. Matching (`matching`)
```typescript
{
  ref: "a0.basics.001.t4",
  type: "matching",
  data: {
    instruction: "Соедините слова с переводом",
    pairs: [
      {
        left: "Hello",
        right: "Привет", 
        audioKey: "a0.basics.001.t4.hello"
      }
    ]
  }
}
```

## A0 Content Modules

### Module 1: "Основы A0" (`a0.basics`)
**Lessons:** 6 lessons, 5-15 minutes each
**Focus:** Foundation skills

1. **Hello and Goodbye** - Basic greetings
2. **My Name Is...** - Introductions
3. **Where Are You From?** - Countries and origin
4. **Numbers 1-10** - Basic counting
5. **English Alphabet** - Letters and sounds
6. **Simple Introductions** - Putting it all together

### Module 2: "Путешествия A0" (`a0.travel`)
**Lessons:** 6 lessons, 10-18 minutes each
**Focus:** Travel scenarios

1. **At the Airport** - Terminal, gate, ticket, baggage
2. **Security Check** - Passport, procedures
3. **Boarding the Plane** - Finding seat, boarding
4. **On the Airplane** - Requests, bathroom, water
5. **Passport Control** - Purpose, duration
6. **Taxi and Hotel** - Transportation, check-in

## Audio Key Mapping

### Naming Convention
```
{moduleRef}.{lessonSequence}.t{taskNumber}.{wordKey}
```

### Examples
- `a0.basics.001.t1.hello` → "Hello" pronunciation
- `a0.travel.003.t5.seat` → "Seat" pronunciation  
- `a0.basics.004.t6.three` → "Three" pronunciation

### Audio Content Table

| Module | Lesson | Key | English | Russian | Duration |
|--------|--------|-----|---------|---------|----------|
| a0.basics | 001 | hello | Hello | Привет | 1s |
| a0.basics | 001 | goodbye | Goodbye | До свидания | 1.5s |
| a0.basics | 002 | myname | My name is... | Меня зовут... | 2s |
| a0.travel | 001 | airport | Airport | Аэропорт | 1.5s |
| a0.travel | 001 | ticket | Ticket | Билет | 1s |

> **Note:** Audio files should be generated using TTS and placed in `public/audio/` directory

## Quality Standards

### A0 Level Requirements
- **Vocabulary:** 8-12 words per lesson
- **Grammar:** Maximum 1-2 constructions
- **Cognitive load:** Minimal complexity
- **Russian support:** Explanations and glossaries
- **Spaced repetition:** Words repeat every 2-3 lessons

### Task Distribution per Lesson
- **Flashcards:** 2-3 tasks (vocabulary practice)
- **Multiple Choice:** 2-3 tasks (comprehension check)
- **Listening:** 1-2 tasks (pronunciation practice)
- **Matching:** 1-2 tasks (connection building)

### Validation Requirements
- All tasks must pass class-validator DTO validation
- Audio keys must follow naming convention
- Russian explanations required for A0
- XP rewards: 5 per task, 25 per lesson completion

## Lesson Gating System

### Prerequisites
Each lesson requires completion of the previous lesson in the same module.

### Implementation
- **Field:** `UserLessonProgress.status` must be `"completed"`
- **Guard:** `LessonPrerequisiteGuard` enforces prerequisites
- **API:** `GET /content/lessons/:lessonRef/check-prerequisite` checks access
- **Exception:** First lesson in module (`order: 1`) is always accessible

### Error Response
```json
{
  "error": "PREREQ_NOT_MET",
  "message": "Previous lesson a0.basics.001 must be completed",
  "requiredLesson": "a0.basics.001",
  "currentLesson": "a0.basics.002"
}
```

## Seeding Procedures

### File Structure
```
content/
├── seeds/
│   ├── a0-basics.json     # Module 1 data
│   └── a0-travel.json     # Module 2 data
└── scripts/
    └── seed-a0.ts         # Seeding script
```

### NPM Scripts
```bash
npm run seed:a0:dry        # Preview changes
npm run seed:a0            # Apply changes
```

### Seeding Process
1. **Validation:** All DTOs validated before insertion
2. **Transactions:** Atomic operations with rollback on error
3. **Idempotency:** Safe to run multiple times
4. **Logging:** Detailed progress and error reporting

### Example Usage
```bash
# Preview what will be changed
npm run seed:a0:dry

# Apply the changes to database
npm run seed:a0
```

## Testing

### Validation Tests
- **DTO compliance:** All tasks pass class-validator
- **Content quality:** Spaced repetition, Russian explanations
- **Audio keys:** Proper naming convention
- **Lesson structure:** Correct order, timing, difficulty

### E2E Tests
- **Module loading:** API returns A0 modules
- **Lesson gating:** Prerequisites enforced
- **Task submission:** Answers processed correctly
- **Progress tracking:** XP and completion status

### Running Tests
```bash
npm run test test/a0-content-validation.spec.ts
npm run test:e2e test/a0-content-api.e2e-spec.ts
```

## Swagger Documentation

### New Endpoints
The following endpoints support A0 content:

- `GET /content/v2/modules` - Returns published modules with availability/progress
- `GET /content/v2/modules/{moduleRef}/lessons` - Lessons list for module
- `GET /content/v2/lessons/{lessonRef}` - Lesson details with tasks
- `GET /content/lessons/{lessonRef}/check-prerequisite` - Check prerequisites
- `POST /progress/sessions/start` - Start learning session
- `POST /progress/submit-answer` - Submit and validate task answer
- `POST /progress/sessions/{sessionId}/end` - End learning session

### Enhanced DTOs
New task types are fully supported:
- `FlashcardTaskDataDto` - Flashcard validation
- `MatchingTaskDataDto` - Matching pairs validation
- `MatchingPairDto` - Individual pair validation

## Maintenance

### Adding New Content
1. Create JSON seed file following structure
2. Validate using test suite
3. Run dry-run to preview changes
4. Apply with transaction safety
5. Verify with E2E tests

### Audio File Management
1. Generate TTS files for all `audioKey` references
2. Place in `public/audio/{audioKey}.mp3`
3. Ensure consistent quality and volume
4. Update audio mapping table

### Content Updates
- Safe to update unpublished content
- Published content updates require careful review
- Always test prerequisite chains after changes
- Validate all task DTOs after modifications

---

**Last Updated:** September 2025  
**Version:** 1.0  
**Modules:** A0 Foundation (2 modules, 12 lessons, 88 tasks)
