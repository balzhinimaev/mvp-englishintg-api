import { canonicalizeTaskType, normalizeTaskType, TaskTypeEnum } from '../task-type.enum';

describe('task type normalization', () => {
  it('normalizes aliases to canonical task types', () => {
    expect(normalizeTaskType('choice')).toBe(TaskTypeEnum.CHOICE);
    expect(normalizeTaskType('listen')).toBe(TaskTypeEnum.LISTEN);
    expect(normalizeTaskType('match')).toBe(TaskTypeEnum.MATCH);

    expect(canonicalizeTaskType('choice')).toBe(TaskTypeEnum.MULTIPLE_CHOICE);
    expect(canonicalizeTaskType('listen')).toBe(TaskTypeEnum.LISTENING);
    expect(canonicalizeTaskType('match')).toBe(TaskTypeEnum.MATCHING);
  });

  it('keeps canonical types unchanged', () => {
    expect(canonicalizeTaskType('multiple_choice')).toBe(TaskTypeEnum.MULTIPLE_CHOICE);
    expect(canonicalizeTaskType('listening')).toBe(TaskTypeEnum.LISTENING);
    expect(canonicalizeTaskType('matching')).toBe(TaskTypeEnum.MATCHING);
    expect(canonicalizeTaskType('gap')).toBe(TaskTypeEnum.GAP);
  });

  it('returns undefined for unknown task type', () => {
    expect(canonicalizeTaskType('unknown_x')).toBeUndefined();
  });
});
