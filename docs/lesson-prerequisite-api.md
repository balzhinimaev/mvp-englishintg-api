# Lesson Prerequisite API Documentation

## Overview
This API implements server-side validation to ensure users cannot start a lesson without completing the previous lesson in the same module.

## Endpoints

### GET /content/lessons/:lessonRef
**Description:** Retrieves lesson details with tasks. Requires previous lesson to be completed if not the first lesson in module.

**Parameters:**
- `lessonRef` (path): Lesson reference (e.g., a0.basics.001)
- JWT user is resolved from `Authorization: Bearer <token>`
- `lang` (query): Language code (optional, default: ru)

**Responses:**

**200 OK - Lesson details retrieved successfully**
```json
{
  "lesson": {
    "lessonRef": "a0.basics.001",
    "title": "Hello & Greetings",
    "tasks": [...]
  }
}
```

**403 Forbidden - Previous lesson not completed**
```json
{
  "error": "PREREQ_NOT_MET",
  "message": "Previous lesson a0.basics.001 must be completed before starting a0.basics.002",
  "requiredLesson": "a0.basics.001",
  "currentLesson": "a0.basics.002"
}
```

**400 Bad Request - Invalid lessonRef format**
```json
{
  "error": "Invalid lessonRef format"
}
```

**404 Not Found - Lesson not found**
```json
{
  "error": "Lesson not found"
}
```

### GET /content/lessons/:lessonRef/check-prerequisite
**Description:** Checks if user can start a lesson based on previous lesson completion status.

**Parameters:**
- `lessonRef` (path): Lesson reference (e.g., a0.basics.001)
- JWT user is resolved from `Authorization: Bearer <token>`

**Responses:**

**200 OK - Prerequisite check completed**
```json
{
  "canStart": true,
  "reason": "Previous lesson a0.basics.001 must be completed before starting a0.basics.002",
  "requiredLesson": "a0.basics.001",
  "lessonRef": "a0.basics.002"
}
```

**401 Unauthorized - Missing/invalid JWT**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## Business Rules

1. **First Lesson Access**: Users can always access the first lesson in any module (order = 1)
2. **Sequential Access**: Users must complete lesson N-1 before accessing lesson N
3. **Module Isolation**: Prerequisites only apply within the same module
4. **Completion Status**: Only lessons with status 'completed' count as prerequisites

## Error Codes

- `PREREQ_NOT_MET`: Previous lesson not completed
- `INVALID_LESSON_REF`: Invalid lesson reference format
- `LESSON_NOT_FOUND`: Lesson does not exist
- `USER_NOT_FOUND`: User does not exist

## Examples

### Successful Access to First Lesson
```bash
GET /content/lessons/a0.basics.001
Authorization: Bearer <token>
# Returns: 200 OK with lesson details
```

### Blocked Access to Second Lesson
```bash
GET /content/lessons/a0.basics.002
Authorization: Bearer <token>
# Returns: 403 Forbidden with PREREQ_NOT_MET error
```

### Check Prerequisites
```bash
GET /content/lessons/a0.basics.002/check-prerequisite
Authorization: Bearer <token>
# Returns: 200 OK with canStart: false
```

## Implementation Details

- **Guard**: `LessonPrerequisiteGuard` validates access before controller execution
- **Service**: `ContentService.canStartLesson()` provides business logic
- **Database**: Queries `lessons` and `user_lesson_progress` collections
- **Performance**: Uses MongoDB indexes for efficient queries
