/**
 * 卡厄思梦境 — 最优暴击分析器
 * 生成暴击率 × 暴击伤害的 2D 期望伤害曲面，用于可视化与最优解搜索。
 * ES Module，依赖 damage-engine.js。
 */

import { calculateExpectedDamage } from './damage-engine.js';

// ─── generateCritSurface ─────────────────────────────────────────────────────

/**
 * 生成暴击率 × 暴击伤害的期望伤害二维网格。
 *
 * @param {object} baseInput - 除 critRate / critDmgRate 外的所有伤害参数：
 *   { effValue, stat, dmgType, colorDmgRate, addiAtkDmgRate, dvaList, psRatio }
 * @param {{ min: number, max: number, step: number }} critRateRange
 *   暴击率范围（百分比），默认 { min: 0, max: 100, step: 1 }
 * @param {{ min: number, max: number, step: number }} critDmgRange
 *   暴击伤害范围（百分比），默认 { min: 100, max: 300, step: 2 }
 * @returns {{
 *   x: number[],          // critRate 轴
 *   y: number[],          // critDmgRate 轴
 *   z: number[][],        // 期望伤害矩阵 [yIndex][xIndex]，兼容 Plotly surface
 *   maxPoint: { critRate: number, critDmgRate: number, expectedDamage: number }
 * }}
 */
export function generateCritSurface(
  baseInput,
  critRateRange = { min: 0, max: 100, step: 1 },
  critDmgRange = { min: 100, max: 300, step: 2 },
) {
  const { min: xMin, max: xMax, step: xStep } = critRateRange;
  const { min: yMin, max: yMax, step: yStep } = critDmgRange;

  // ── Build axis arrays ──
  const x = [];
  for (let v = xMin; v <= xMax; v += xStep) x.push(v);

  const y = [];
  for (let v = yMin; v <= yMax; v += yStep) y.push(v);

  // ── Compute z matrix & track max ──
  const z = [];
  let maxVal = -Infinity;
  let maxI = 0;
  let maxJ = 0;

  for (let i = 0; i < y.length; i++) {
    const row = new Array(x.length);
    const critDmgRate = y[i];

    for (let j = 0; j < x.length; j++) {
      const critRate = x[j];

      const { expectedDamage } = calculateExpectedDamage({
        ...baseInput,
        critRate,
        critDmgRate,
      });

      row[j] = expectedDamage;

      if (expectedDamage > maxVal) {
        maxVal = expectedDamage;
        maxI = i;
        maxJ = j;
      }
    }

    z.push(row);
  }

  return {
    x,
    y,
    z,
    maxPoint: {
      critRate: x[maxJ],
      critDmgRate: y[maxI],
      expectedDamage: maxVal,
    },
  };
}

// ─── findOptimalCrit ─────────────────────────────────────────────────────────

/**
 * 便捷函数：仅返回最优暴击参数组合。
 *
 * @param {object} baseInput - 同 generateCritSurface
 * @param {{ min: number, max: number, step: number }} critRateRange
 * @param {{ min: number, max: number, step: number }} critDmgRange
 * @returns {{ critRate: number, critDmgRate: number, expectedDamage: number }}
 */
export function findOptimalCrit(
  baseInput,
  critRateRange = { min: 0, max: 100, step: 1 },
  critDmgRange = { min: 100, max: 300, step: 2 },
) {
  return generateCritSurface(baseInput, critRateRange, critDmgRange).maxPoint;
}

// ─── 有限资源约束优化 ────────────────────────────────────────────────────────

/**
 * 给定基础暴击率/暴伤 + 可分配属性点数，求最优分配比例。
 *
 * @param {object} baseInput - 同 generateCritSurface
 * @param {object} constraint:
 *   baseCritRate   - 基础暴击率 (%)
 *   baseCritDmg    - 基础暴伤 (%)
 *   totalPoints    - 可分配总属性点
 *   critRatePerPoint - 每点暴击率增量 (%)，默认 1
 *   critDmgPerPoint  - 每点暴伤增量 (%)，默认 2
 *   critRateCap      - 暴击率上限 (%)，默认 100
 *   critDmgCap       - 暴伤上限 (%)，默认 300
 * @returns {{
 *   optimalCritRate: number,
 *   optimalCritDmg: number,
 *   pointsIntoRate: number,
 *   pointsIntoDmg: number,
 *   expectedDamage: number,
 *   curve: { pointsIntoRate: number, critRate: number, critDmg: number, expectedDamage: number }[]
 * }}
 */
export function findOptimalAllocation(baseInput, constraint) {
  const {
    baseCritRate = 0,
    baseCritDmg = 150,
    totalPoints = 20,
    critRatePerPoint = 1,
    critDmgPerPoint = 2,
    critRateCap = 100,
    critDmgCap = 300,
  } = constraint;

  const curve = [];
  let bestDamage = -1;
  let bestI = 0;

  // 尝试所有分配方案：i 点给暴击率，其余给暴伤
  for (let i = 0; i <= totalPoints; i++) {
    const critRate = Math.min(baseCritRate + i * critRatePerPoint, critRateCap);
    const critDmg = Math.min(baseCritDmg + (totalPoints - i) * critDmgPerPoint, critDmgCap);

    const { expectedDamage } = calculateExpectedDamage({
      ...baseInput,
      critRate,
      critDmgRate: critDmg,
    });

    curve.push({
      pointsIntoRate: i,
      critRate,
      critDmg,
      expectedDamage,
    });

    if (expectedDamage > bestDamage) {
      bestDamage = expectedDamage;
      bestI = i;
    }
  }

  const best = curve[bestI];
  return {
    optimalCritRate: best.critRate,
    optimalCritDmg: best.critDmg,
    pointsIntoRate: best.pointsIntoRate,
    pointsIntoDmg: totalPoints - best.pointsIntoRate,
    expectedDamage: best.expectedDamage,
    curve,
  };
}

// ─── 装备词条优化 ──────────────────────────────────────────────────────────

/**
 * 装备词条分配优化：主词条二选一 + 副词条30次强化分配。
 *
 * @param {object} baseInput - 同 generateCritSurface
 * @param {object} equip:
 *   baseCritRate     - 角色基础暴击率 (%)，如 3
 *   baseCritDmg      - 角色基础暴伤 (%)，如 125
 *   totalRolls       - 副词条总强化次数，如 30
 *   critRateMain     - 主词条暴击率加成 (%)，如 27
 *   critDmgMain      - 主词条暴伤加成 (%)，如 40.8
 *   critRatePerRoll  - 每次暴击率副词条期望值 (%)，如 1.6 (1.2~2.0均值)
 *   critDmgPerRoll   - 每次暴伤副词条期望值 (%)，如 3.2 (2.4~4.0均值)
 *   critRateCap      - 暴击率上限 (%)，默认 100
 *   critDmgCap       - 暴伤上限 (%)，默认 300
 * @returns {{
 *   mainCritRate: { optimal, curve },   - 主词条选暴击率时的最优方案
 *   mainCritDmg:  { optimal, curve },   - 主词条选暴伤时的最优方案
 *   recommendation: 'critRate' | 'critDmg', - 推荐主词条
 *   bestOverall: { mainStat, critRate, critDmg, subRateRolls, subDmgRolls, expectedDamage }
 * }}
 */
export function findOptimalEquipment(baseInput, equip) {
  const {
    baseCritRate = 3,
    baseCritDmg = 125,
    totalRolls = 30,
    critRateMain = 27,
    critDmgMain = 40.8,
    critRatePerRoll = 1.6,
    critDmgPerRoll = 3.2,
    critHitRate = 1.0,    // 每次强化命中考暴击词条的概率 (0~1)
    critRateCap = 100,
    critDmgCap = 300,
  } = equip;

  // 有效强化次数 = 总次数 × 命中率
  const effectiveRolls = Math.round(totalRolls * critHitRate);

  function sweep(mainStatType) {
    const mainRate = mainStatType === 'critRate' ? critRateMain : 0;
    const mainDmg  = mainStatType === 'critDmg'  ? critDmgMain : 0;

    const curve = [];
    let bestDamage = -1;
    let bestI = 0;

    for (let i = 0; i <= effectiveRolls; i++) {
      const critRate = Math.min(baseCritRate + mainRate + i * critRatePerRoll, critRateCap);
      const critDmg  = Math.min(baseCritDmg  + mainDmg  + (effectiveRolls - i) * critDmgPerRoll, critDmgCap);

      const { expectedDamage } = calculateExpectedDamage({
        ...baseInput,
        critRate,
        critDmgRate: critDmg,
      });

      curve.push({
        subRateRolls: i,
        subDmgRolls: effectiveRolls - i,
        wastedRolls: totalRolls - effectiveRolls,
        critRate: Math.round(critRate * 10) / 10,
        critDmg: Math.round(critDmg * 10) / 10,
        expectedDamage: Math.floor(expectedDamage),
      });

      if (expectedDamage > bestDamage) {
        bestDamage = expectedDamage;
        bestI = i;
      }
    }

    return { optimal: curve[bestI], curve };
  }

  const mainCritRate = sweep('critRate');
  const mainCritDmg  = sweep('critDmg');

  const recommendation = mainCritRate.optimal.expectedDamage >= mainCritDmg.optimal.expectedDamage
    ? 'critRate' : 'critDmg';

  const bestOverall = recommendation === 'critRate'
    ? { mainStat: '暴击率 +27%', ...mainCritRate.optimal }
    : { mainStat: '暴伤 +40.8%', ...mainCritDmg.optimal };

  return { mainCritRate, mainCritDmg, recommendation, bestOverall, effectiveRolls };
}

// ─── 装备蒙特卡洛模拟 ──────────────────────────────────────────────────────

/**
 * 模拟装备强化随机过程：每次副词条强化随机取值，统计最终伤害分布。
 *
 * @param {object} baseInput - 同 generateCritSurface
 * @param {object} equip:
 *   baseCritRate, baseCritDmg, totalRolls, critRateMain, critDmgMain,
 *   critRateMin (1.2), critRateMax (2.0),
 *   critDmgMin (2.4), critDmgMax (4.0),
 *   subRateRolls, subDmgRolls,  - 分配方案（来自主优化器）
 *   iterations (10000), seed (optional)
 * @returns {{
 *   stats: { mean, median, p5, p95, min, max }[],
 *   damage: { mean, median, p5, p95, min, max },
 *   samples: { critRate, critDmg, damage }[]
 * }}
 */
export function simulateEquipmentRolls(baseInput, equip) {
  const {
    baseCritRate = 3,
    baseCritDmg = 125,
    critRateMain = 27,
    critDmgMain = 40.8,
    critRateMin = 1.2,
    critRateMax = 2.0,
    critDmgMin = 2.4,
    critDmgMax = 4.0,
    critRateCap = 100,
    critDmgCap = 300,
    subRateRolls = 9,
    subDmgRolls = 21,
    totalRolls = 30,
    critHitRate = 1.0,    // 每次强化命中考暴击词条的概率
    mainStat = 'critRate',
    iterations = 10000,
    seed = null,
  } = equip;

  // 简单 RNG
  let rng = seed != null
    ? (() => { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()
    : Math.random;

  const mainRate = mainStat === 'critRate' ? critRateMain : 0;
  const mainDmg  = mainStat === 'critDmg'  ? critDmgMain : 0;

  // 分配比例：命中的强化中，暴击率占多少
  const totalCritRolls = subRateRolls + subDmgRolls;
  const rateRatio = totalCritRolls > 0 ? subRateRolls / totalCritRolls : 0.5;

  const critRates = [];
  const critDmgs = [];
  const damages = [];
  const hitCounts = [];  // 记录每次模拟实际命中几次
  const samples = [];

  for (let n = 0; n < iterations; n++) {
    let rateBonus = 0;
    let dmgBonus = 0;
    let hits = 0;

    for (let r = 0; r < totalRolls; r++) {
      // 每次强化有 critHitRate 概率命中暴击词条
      if (rng() < critHitRate) {
        hits++;
        if (rng() < rateRatio) {
          rateBonus += critRateMin + rng() * (critRateMax - critRateMin);
        } else {
          dmgBonus += critDmgMin + rng() * (critDmgMax - critDmgMin);
        }
      }
      // 否则歪到其他属性，不影响暴击
    }

    const critRate = Math.min(baseCritRate + mainRate + rateBonus, critRateCap);
    const critDmg  = Math.min(baseCritDmg  + mainDmg  + dmgBonus,  critDmgCap);

    const { expectedDamage } = calculateExpectedDamage({
      ...baseInput, critRate, critDmgRate: critDmg,
    });

    critRates.push(critRate);
    critDmgs.push(critDmg);
    damages.push(Math.floor(expectedDamage));
    hitCounts.push(hits);
    samples.push({ critRate: Math.round(critRate * 10) / 10, critDmg: Math.round(critDmg * 10) / 10, damage: Math.floor(expectedDamage), hits });
  }

  function stats(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      mean: Math.round((sum / n) * 10) / 10,
      median: sorted[Math.floor(n / 2)],
      p5: sorted[Math.floor(n * 0.05)],
      p95: sorted[Math.floor(n * 0.95)],
      min: sorted[0],
      max: sorted[n - 1],
    };
  }

  return {
    critRate: stats(critRates),
    critDmg: stats(critDmgs),
    damage: stats(damages),
    hitCount: stats(hitCounts),
    samples: samples.slice(0, 200),
  };
}
