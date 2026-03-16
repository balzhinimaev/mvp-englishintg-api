# Task Contract v2.1 (Canonical)

This document defines canonical task types and payload shapes returned by content APIs.

## Canonical task types

- `multiple_choice`
- `gap`
- `listening`
- `matching`
- `flashcard`
- `order`
- `translate`
- `speak`

## Alias compatibility (deprecated path)

Input aliases are still accepted and normalized in backend:

- `choice` -> `multiple_choice`
- `listen` -> `listening`
- `match` -> `matching`

### Deprecation timeline

- **Now (v2.1):** aliases accepted on input, canonical types emitted in API responses.
- **Next minor:** warnings in lint/migration output for alias usage in seed content.
- **Next major:** alias values removed from authored content and no longer recommended.

## Canonical `task.data` snippets

### multiple_choice
```json
{
  "ref": "a0.basics.001.t1",
  "type": "multiple_choice",
  "data": {
    "question": "How are you?",
    "options": ["Fine", "Table"],
    "explanation": "Pick the greeting response"
  }
}
```

### gap
```json
{
  "ref": "a0.basics.001.t2",
  "type": "gap",
  "data": {
    "text": "I ___ happy",
    "hint": "verb to be",
    "explanation": "Use present tense"
  }
}
```

### listening
```json
{
  "ref": "a0.basics.001.t3",
  "type": "listening",
  "data": {
    "audioKey": "a0.basics.001.t3.audio",
    "question": "What did you hear?",
    "translation": "Что вы услышали?"
  }
}
```

### matching
```json
{
  "ref": "a0.basics.001.t4",
  "type": "matching",
  "data": {
    "instruction": "Match words",
    "pairs": [
      { "left": "cat", "right": "кот" }
    ]
  }
}
```

### flashcard
```json
{
  "ref": "a0.basics.001.t5",
  "type": "flashcard",
  "data": {
    "front": "Hello",
    "example": "Hello, Alex!",
    "audioKey": "a0.basics.001.t5.audio"
  }
}
```

### order
```json
{
  "ref": "a0.basics.001.t6",
  "type": "order",
  "data": {
    "tokens": ["What", "time", "is", "it", "?"]
  }
}
```

### translate
```json
{
  "ref": "a0.basics.001.t7",
  "type": "translate",
  "data": {
    "question": "Translate: Привет"
  }
}
```

### speak
```json
{
  "ref": "a0.basics.001.t8",
  "type": "speak",
  "data": {
    "prompt": "Say: Hello"
  }
}
```
