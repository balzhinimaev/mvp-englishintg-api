import { toTaskResponseDto } from '../mappers';

describe('toTaskResponseDto matching payload normalization', () => {
  it('keeps canonical left/right shape as-is', () => {
    const dto = toTaskResponseDto({
      ref: 't1',
      type: 'matching',
      data: {
        instruction: 'match words',
        pairs: [{ left: 'cat', right: 'кот' }],
      },
    });

    expect(dto.type).toBe('matching');
    expect(dto.data.instruction).toBe('match words');
    expect(dto.data.pairs).toEqual([{ left: 'cat', right: 'кот', audioKey: undefined }]);
  });

  it('normalizes legacy english/russian pair keys into left/right', () => {
    const dto = toTaskResponseDto({
      ref: 't2',
      type: 'matching',
      data: {
        instructions: 'legacy payload',
        pairs: [{ english: 'dog', russian: 'собака' }],
      },
    });

    expect(dto.type).toBe('matching');
    expect(dto.data.instruction).toBe('legacy payload');
    expect(dto.data.pairs[0].left).toBe('dog');
    expect(dto.data.pairs[0].right).toBe('собака');
    expect(dto.data.pairs[0].english).toBeUndefined();
    expect(dto.data.pairs[0].russian).toBeUndefined();
  });
});
