/**
 * 卡厄思梦境 — 蒙特卡洛伤害模拟模块
 * ES Module，依赖 damage-engine.js
 */

import { calculateDamage } from './damage-engine.js';

// ─── 1. Seeded RNG (Mulberry32) ──────────────────────────────────────────────

/**
 * 创建基于 Mulberry32 算法的伪随机数生成器。
 * @param {number} seed - 随机种子
 * @returns {function(): number} 返回 [0, 1) 范围的随机数
 */
export function createRNG(seed) {
  let state = seed | 0;
  return function () {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── 2. computeStatistics ────────────────────────────────────────────────────

/**
 * 从已排序的数值数组中计算统计指标。
 * @param {number[]} sorted - 已升序排列的数值数组
 * @returns {{ mean: number, median: number, p25: number, p75: number, min: number, max: number }}
 */
export function computeStatistics(sorted) {
  const len = sorted.length;
  if (len === 0) {
    return { mean: 0, median: 0, p25: 0, p75: 0, min: 0, max: 0 };
  }

  // Mean
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += sorted[i];
  }
  const mean = sum / len;

  // Percentile helper (linear interpolation)
  function percentile(p) {
    const idx = (p / 100) * (len - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const frac = idx - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  }

  return {
    mean,
    median: percentile(50),
    p25: percentile(25),
    p75: percentile(75),
    min: sorted[0],
    max: sorted[len - 1],
  };
}

// ─── 3. runMonteCarlo ────────────────────────────────────────────────────────

/**
 * 蒙特卡洛伤害模拟。
 *
 * @param {object} damageInput - calculateDamage() 所需的输入对象，
 *   包含 effValue, stat, dmgType, critRate, critDmgRate, colorDmgRate,
 *   addiAtkDmgRate, dvaList, psRatio 等字段。
 * @param {number} iterations - 模拟次数 (1000 / 10000 / 100000 / 1000000)
 * @param {number|null} seed - 随机种子，null 则使用 Math.random
 * @returns {object} 模拟结果统计
 */
export function runMonteCarlo(damageInput, iterations, seed = null) {
  const rng = seed !== null ? createRNG(seed) : Math.random;

  // Pre-compute non-crit and crit damage once (deterministic)
  const baseResult = calculateDamage(damageInput);
  const normalDmg = baseResult.normalDamage;
  const critDmg = baseResult.critDamage;
  const critThreshold = (damageInput.critRate ?? 0) / 100;

  // Storage
  const damages = new Array(iterations);
  let critCount = 0;
  let maxCrit = -Infinity;
  let minNonCrit = Infinity;

  for (let i = 0; i < iterations; i++) {
    const isCrit = rng() < critThreshold;
    const dmg = isCrit ? critDmg : normalDmg;
    damages[i] = dmg;

    if (isCrit) {
      critCount++;
      if (dmg > maxCrit) maxCrit = dmg;
    } else {
      if (dmg < minNonCrit) minNonCrit = dmg;
    }
  }

  // Sort for percentile computation
  damages.sort((a, b) => a - b);

  const stats = computeStatistics(damages);

  return {
    mean: stats.mean,
    median: stats.median,
    p25: stats.p25,
    p75: stats.p75,
    min: stats.min,
    max: stats.max,
    maxCrit: maxCrit === -Infinity ? 0 : maxCrit,
    minNonCrit: minNonCrit === Infinity ? 0 : minNonCrit,
    actualCritRate: critCount / iterations,
    distribution: damages,
    iterations,
  };
}
