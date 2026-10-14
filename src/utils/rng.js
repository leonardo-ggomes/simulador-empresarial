/**
 * Gerador determinístico de números pseudo-aleatórios (PRNG).
 * Garante que cada sala/rodada seja 100% reprodutível a partir de uma seed.
 */

export class SeededRNG {
  /**
   * @param {string|number} seed
   */
  constructor(seed) {
    this.seedValue = this._hashSeed(seed);
    this.state = this.seedValue;
  }

  /**
   * Converte qualquer string ou número em um inteiro de 32 bits para a seed.
   */
  _hashSeed(seed) {
    if (typeof seed === 'number') {
      return (seed >>> 0) || 123456789;
    }
    const str = String(seed);
    let hash = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return (hash >>> 0) || 123456789;
  }

  /**
   * Gera o próximo float pseudo-aleatório no intervalo [0, 1) usando Mulberry32.
   * @returns {number}
   */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Gera float no intervalo [min, max).
   * @param {number} min
   * @param {number} max
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Gera inteiro no intervalo [min, max] (inclusivo).
   * @param {number} min
   * @param {number} max
   */
  rangeInt(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return Math.floor(this.range(lo, hi + 1));
  }

  /**
   * Amostra de distribuição normal (Box-Muller).
   * @param {number} mean Média
   * @param {number} stdDev Desvio padrão
   */
  normal(mean = 0, stdDev = 1) {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
  }

  /**
   * Embaralha um array in-place (Fisher-Yates determinístico).
   * @template T
   * @param {T[]} array
   * @returns {T[]}
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
