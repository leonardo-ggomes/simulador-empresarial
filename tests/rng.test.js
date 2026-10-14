import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../src/utils/rng.js';

describe('SeededRNG (PRNG Determinístico)', () => {
  it('deve produzir exatamente a mesma sequência com a mesma seed', () => {
    const rng1 = new SeededRNG('porto_aurora_2031');
    const rng2 = new SeededRNG('porto_aurora_2031');

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('deve produzir sequências diferentes com seeds distintas', () => {
    const rngA = new SeededRNG('seed_alpha');
    const rngB = new SeededRNG('seed_beta');

    expect(rngA.next()).not.toEqual(rngB.next());
  });

  it('deve respeitar os intervalos definidos em range e rangeInt', () => {
    const rng = new SeededRNG('teste_intervalos');
    for (let i = 0; i < 50; i++) {
      const floatVal = rng.range(10.5, 20.5);
      expect(floatVal).toBeGreaterThanOrEqual(10.5);
      expect(floatVal).toBeLessThan(20.5);

      const intVal = rng.rangeInt(1, 6);
      expect(intVal).toBeGreaterThanOrEqual(1);
      expect(intVal).toBeLessThanOrEqual(6);
      expect(Number.isInteger(intVal)).toBe(true);
    }
  });

  it('deve embaralhar arrays de forma determinística', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuf1 = rng1.shuffle(base);
    const shuf2 = rng2.shuffle(base);

    expect(shuf1).toEqual(shuf2);
    expect(shuf1).toHaveLength(10);
  });
});
