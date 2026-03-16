import { toTaskResponseDto } from '../mappers';

describe('toTaskResponseDto matching payload normalization', () => {
  it('emits canonical task type names for aliases', () => {
    const dtoChoice = toTaskResponseDto({
      ref: 'tc',
      type: 'choice',
      data: { question: 'Q', options: ['a', 'b'], correctIndex: 0 },
    });
    expect(dtoChoice.type).toBe('multiple_choice');

    const dtoListen = toTaskResponseDto({
      ref: 'tl',
      type: 'listen',
      data: { audioKey: 'k1', question: 'heard?' },
    });
    expect(dtoListen.type).toBe('listening');

    const dtoMatch = toTaskResponseDto({
      ref: 'tm',
      type: 'match',
      data: { pairs: [{ left: 'a', right: 'б' }] },
    });
    expect(dtoMatch.type).toBe('matching');
  });
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
