export interface DeterministicRandom {
  chance(probability: number): boolean;
  integer(minimum: number, maximum: number): number;
  next(): number;
  pick<T>(values: readonly T[]): T;
}

export function createDeterministicRandom(seed: number): DeterministicRandom {
  let state = (seed >>> 0) || 0x6d2b79f5;

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    chance(probability) {
      return next() < probability;
    },
    integer(minimum, maximum) {
      return Math.floor(next() * (maximum - minimum + 1)) + minimum;
    },
    pick<T>(values: readonly T[]) {
      if (values.length === 0) {
        throw new Error("Cannot pick from an empty collection.");
      }
      return values[Math.floor(next() * values.length)] as T;
    },
  };
}
