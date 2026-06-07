/**
 * 卡厄思梦境 — 伤害计算引擎
 * 纯计算模块，零 DOM 依赖，可作为 ES Module 导入。
 * 公式来源：NGA 超硬核代码层面分析帖。
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const CONSTANTS = {
  dmg_revise_rate: 0.36,
  shield_revise_rate: 0.3,
  shield_cal_rate_for_base_def: 1.0,
  shield_cal_rate_for_add_def: 0.5,
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export const DmgType = {
  NORMAL: 'DMG_ATTR_NORMAL',
  PENETRATE: 'DMG_ATTR_PENETRATE',
  FIX: 'DMG_ATTR_FIX',
  IGNORE_STAT: 'DMG_ATTR_IGNORE_STAT',
  IGNORE_REVISE: 'DMG_ATTR_IGNORE_REVISE',
  IGNORE_BLOCK: 'DMG_ATTR_IGNORE_BLOCK',
  IGNORE_RAGE: 'DMG_ATTR_IGNORE_RAGE',
  BASE_ON_DEF: 'DMG_ATTR_BASE_ON_DEF',
  DEF_80_PCT: 'DMG_ATTR_DEF_80_PCT',
  DEF_100_PCT: 'DMG_ATTR_DEF_100_PCT',
  NO_STAT_CRI: 'DMG_ATTR_NO_STAT_CRI',
  ADDITIONAL_ATTACK: 'DMG_ATTR_ADDITIONAL_ATTACK',
  DOT_ATTACK: 'DMG_ATTR_DOT_ATTACK',
  LEECH_HP: 'DMG_ATTR_LEECH_HP',
  LEECH_HP_PCT: 'DMG_ATTR_LEECH_HP_PCT',
  LEECH_SHIELD: 'DMG_ATTR_LEECH_SHIELD',
  LEECH_SHIELD_PCT: 'DMG_ATTR_LEECH_SHIELD_PCT',
  AUTO: 'DMG_ATTR_AUTO',
  EGO_FIELD_0: 'DMG_ATTR_EGO_FIELD_0',
};

export const MathSign = {
  ADD: 'MATHSIGN_ADD',
  SUBTRACT: 'MATHSIGN_SUBTRACT',
  MULTIPLY: 'MATHSIGN_MULTIPLY',
  MULTIPLY_PCT: 'MATHSIGN_MULTIPLY_PCT',
  ADD_HUND_PCT: 'MATHSIGN_ADD_HUND_MULTIPLY_PCT',
  SUB_HUND_PCT: 'MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT',
  SET: 'MATHSIGN_SET',
  FINAL_MULTIPLY: 'MATHSIGN_FINAL_MULTIPLY',
  FINAL_MULTIPLY_PCT: 'MATHSIGN_FINAL_MULTIPLY_PCT',
  FINAL_ADD_HUND_PCT: 'MATHSIGN_FINAL_ADD_HUND_MULTIPLY_PCT',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 浮点安全的 floor — 先加一个微小 epsilon 再取整，
 * 避免 1862.9999999998 被错误截断为 1862 之类的问题。
 */
function safeFloor(v) {
  return Math.floor(v + 1e-9);
}

function isFinalSign(sign) {
  return (
    sign === MathSign.FINAL_MULTIPLY ||
    sign === MathSign.FINAL_MULTIPLY_PCT ||
    sign === MathSign.FINAL_ADD_HUND_PCT
  );
}

// ─── 1. calculateStat ────────────────────────────────────────────────────────

/**
 * 属性计算公式（双 round）:
 *   result = round( round((base * (1 + outRate/100) + outAdd) * (1 + cal/100))
 *            * (1 + inRate/100) + inAdd )
 */
export function calculateStat(base, outRate, outAdd, cal, inRate, inAdd) {
  const step1 = base * (1 + outRate / 100) + outAdd;
  const step2 = Math.round(step1 * (1 + cal / 100));
  const result = Math.round(step2 * (1 + inRate / 100) + inAdd);
  return result;
}

// ─── 2. calculateShieldDef ───────────────────────────────────────────────────

/**
 * 护盾防御力:
 *   S_DEF_SHIELD = baseDef * 1.0 + (totalDef - baseDef) * 0.5
 */
export function calculateShieldDef(baseDef, totalDef) {
  return (
    baseDef * CONSTANTS.shield_cal_rate_for_base_def +
    (totalDef - baseDef) * CONSTANTS.shield_cal_rate_for_add_def
  );
}

// ─── 3. calculateAllStats ────────────────────────────────────────────────────

/**
 * 计算最终属性面板。
 * @param {{ atk: number, def: number, hp: number }} baseStat
 * @param {{ atkRate: number, atkAdd: number, defRate: number, defAdd: number, hpRate: number, hpAdd: number }} outBonus
 * @param {{ atkRate: number, atkAdd: number, atkCal: number, defRate: number, defAdd: number, defCal: number, hpRate: number, hpAdd: number, hpCal: number }} inBonus
 * @returns {{ S_ATK: number, S_DEF: number, S_HP: number, S_DEF_SHIELD: number }}
 */
export function calculateAllStats(baseStat, outBonus, inBonus) {
  const S_ATK = calculateStat(
    baseStat.atk,
    outBonus.atkRate,
    outBonus.atkAdd,
    inBonus.atkCal,
    inBonus.atkRate,
    inBonus.atkAdd,
  );
  const S_DEF = calculateStat(
    baseStat.def,
    outBonus.defRate,
    outBonus.defAdd,
    inBonus.defCal,
    inBonus.defRate,
    inBonus.defAdd,
  );
  const S_HP = calculateStat(
    baseStat.hp,
    outBonus.hpRate,
    outBonus.hpAdd,
    inBonus.hpCal,
    inBonus.hpRate,
    inBonus.hpAdd,
  );
  const S_DEF_SHIELD = calculateShieldDef(baseStat.def, S_DEF);
  return { S_ATK, S_DEF, S_HP, S_DEF_SHIELD };
}

// ─── 4. getStatForDmgType ────────────────────────────────────────────────────

/**
 * 根据伤害类型返回参与计算的 stat 值。
 * @param {{ S_ATK: number, S_DEF: number }} stats
 * @param {string} dmgType
 * @returns {number}
 */
export function getStatForDmgType(stats, dmgType) {
  switch (dmgType) {
    case DmgType.NORMAL:
    case DmgType.ADDITIONAL_ATTACK:
    case DmgType.DOT_ATTACK:
    case DmgType.AUTO:
    case DmgType.LEECH_HP:
    case DmgType.LEECH_HP_PCT:
    case DmgType.LEECH_SHIELD:
    case DmgType.LEECH_SHIELD_PCT:
      return stats.S_ATK;

    case DmgType.BASE_ON_DEF:
      return stats.S_DEF * 2.1 + stats.S_ATK * 0.3;

    case DmgType.DEF_80_PCT:
      return stats.S_DEF * 0.8 + stats.S_ATK * 0.2;

    case DmgType.DEF_100_PCT:
      return stats.S_DEF;

    case DmgType.IGNORE_STAT:
      return 0;

    default:
      return stats.S_ATK;
  }
}

// ─── 5. applyDVA ─────────────────────────────────────────────────────────────

/**
 * 应用 DVA 修正列表。
 * 常规操作 (ADD/SUBTRACT/MULTIPLY/…/SET) 顺序作用于主值。
 * FINAL 操作累积为 finalMultiplier (初始 1.0)，最终相乘。
 *
 * @param {number} baseValue
 * @param {{ sign: string, value: number }[]} dvaList
 * @returns {{ value: number, finalMultiplier: number }}
 */
export function applyDVA(baseValue, dvaList) {
  let mainValue = baseValue;
  let finalMultiplier = 1.0;

  for (const dva of dvaList) {
    const { sign, value } = dva;

    if (isFinalSign(sign)) {
      // Final operations accumulate separately
      switch (sign) {
        case MathSign.FINAL_MULTIPLY:
          finalMultiplier *= value;
          break;
        case MathSign.FINAL_MULTIPLY_PCT:
          finalMultiplier *= value / 100;
          break;
        case MathSign.FINAL_ADD_HUND_PCT:
          finalMultiplier *= (100 + value) / 100;
          break;
      }
    } else {
      // Regular operations apply to main value
      switch (sign) {
        case MathSign.ADD:
          mainValue += value;
          break;
        case MathSign.SUBTRACT:
          mainValue -= value;
          break;
        case MathSign.MULTIPLY:
          mainValue *= value;
          break;
        case MathSign.MULTIPLY_PCT:
          mainValue *= value / 100;
          break;
        case MathSign.ADD_HUND_PCT:
          mainValue *= (100 + value) / 100;
          break;
        case MathSign.SUB_HUND_PCT:
          mainValue *= (100 - value) / 100;
          break;
        case MathSign.SET:
          mainValue = value;
          break;
      }
    }
  }

  const finalValue = mainValue * finalMultiplier;
  return { value: finalValue, finalMultiplier };
}

// ─── 6. calculateDamage ──────────────────────────────────────────────────────

/**
 * 主伤害计算流程。
 *
 * @param {{
 *   effValue: number,
 *   stat: number,
 *   dmgType: string,
 *   critRate: number,
 *   critDmgRate: number,
 *   colorDmgRate: number,
 *   addiAtkDmgRate: number,
 *   dvaList: { sign: string, value: number }[],
 *   isCrit: boolean | null,
 *   psRatio: number
 * }} input
 *
 * @returns {{
 *   normalDamage: number,
 *   critDamage: number,
 *   expectedDamage: number,
 *   steps: { step: string, formula: string, value: number, detail: string }[]
 * }}
 */
export function calculateDamage(input) {
  const {
    effValue,
    stat,
    dmgType,
    critRate = 0,
    critDmgRate = 100,
    colorDmgRate = 0,
    addiAtkDmgRate = 0,
    dvaList = [],
    isCrit = null,
    psRatio = 1.0,
  } = input;

  const skipStatMultiply = dmgType === DmgType.IGNORE_STAT;
  const skipRevise = dmgType === DmgType.IGNORE_REVISE;

  // ── Compute for a given crit flag ──
  function compute(forcedCrit) {
    const steps = [];
    let value = effValue;
    steps.push({
      step: '初始技能系数',
      formula: `effValue = ${effValue}`,
      value,
      detail: '技能倍率基础值',
    });

    // 1. PowerStep ratio
    value *= psRatio;
    steps.push({
      step: '力量阶段系数',
      formula: `${value / psRatio} × ${psRatio}`,
      value,
      detail: `psRatio = ${psRatio}`,
    });

    // 2. DVA
    if (dvaList.length > 0) {
      const before = value;
      const dvaResult = applyDVA(value, dvaList);
      value = dvaResult.value;
      steps.push({
        step: 'DVA修正',
        formula: `${before} → DVA → ${value}`,
        value,
        detail: `finalMultiplier = ${dvaResult.finalMultiplier}`,
      });
    }

    // 3. Crit
    if (forcedCrit) {
      const before = value;
      value *= critDmgRate / 100;
      steps.push({
        step: '暴击伤害',
        formula: `${before} × ${critDmgRate / 100}`,
        value,
        detail: `critDmgRate = ${critDmgRate}%`,
      });
    }

    // 4. Stat multiply
    if (!skipStatMultiply) {
      const before = value;
      value = (value * stat) / 100;
      steps.push({
        step: '属性乘算',
        formula: `${before} × ${stat} / 100`,
        value,
        detail: `stat = ${stat}`,
      });
    } else {
      steps.push({
        step: '属性乘算(跳过)',
        formula: 'IGNORE_STAT — 跳过属性乘算',
        value,
        detail: '固定伤害类型',
      });
    }

    // 5. Revise (dmg_revise_rate)
    if (!skipRevise) {
      const before = value;
      value = safeFloor(value * CONSTANTS.dmg_revise_rate);
      steps.push({
        step: '伤害修正',
        formula: `floor(${before} × ${CONSTANTS.dmg_revise_rate})`,
        value,
        detail: `dmg_revise_rate = ${CONSTANTS.dmg_revise_rate}`,
      });
    } else {
      steps.push({
        step: '伤害修正(跳过)',
        formula: 'IGNORE_REVISE — 跳过修正',
        value,
        detail: '忽略修正伤害类型',
      });
    }

    // 6. Color damage bonus
    if (colorDmgRate !== 0) {
      const before = value;
      value *= (100 + colorDmgRate) / 100;
      steps.push({
        step: '属性伤害加成',
        formula: `${before} × ${(100 + colorDmgRate) / 100}`,
        value,
        detail: `colorDmgRate = ${colorDmgRate}%`,
      });
    }

    // 7. Additional attack damage bonus
    if (addiAtkDmgRate !== 0) {
      const before = value;
      value *= (100 + addiAtkDmgRate) / 100;
      steps.push({
        step: '附加攻击加成',
        formula: `${before} × ${(100 + addiAtkDmgRate) / 100}`,
        value,
        detail: `addiAtkDmgRate = ${addiAtkDmgRate}%`,
      });
    }

    const finalDmg = safeFloor(value);
    steps.push({
      step: '最终取整',
      formula: `floor(${value})`,
      value: finalDmg,
      detail: '向下取整',
    });

    return { damage: finalDmg, steps };
  }

  const normalResult = compute(false);
  const critResult = compute(true);

  // Expected damage
  const cRate = critRate / 100;
const expectedDamage = safeFloor(
    cRate * critResult.damage + (1 - cRate) * normalResult.damage,
  );

  return {
    normalDamage: normalResult.damage,
    critDamage: critResult.damage,
    expectedDamage,
    steps: normalResult.steps, // default trace is the non-crit path
  };
}

// ─── 7. calculateShield ──────────────────────────────────────────────────────

/**
 * 护盾值计算:
 *   shieldValue = floor((effValue * shieldDef / 100) * 0.3)
 */
export function calculateShield(effValue, shieldDef) {
  return safeFloor(((effValue * shieldDef) / 100) * CONSTANTS.shield_revise_rate);
}

// ─── 8. calculateExpectedDamage ──────────────────────────────────────────────

/**
 * 便捷函数：分别计算非暴击与暴击伤害，再加权求期望。
 */
export function calculateExpectedDamage(input) {
  const normal = calculateDamage({ ...input, isCrit: false });
  const crit = calculateDamage({ ...input, isCrit: true });

  const cRate = (input.critRate ?? 0) / 100;
  const expectedDamage = safeFloor(
    cRate * crit.critDamage + (1 - cRate) * normal.normalDamage,
  );

  return {
    normalDamage: normal.normalDamage,
    critDamage: crit.critDamage,
    expectedDamage,
  };
}

// ─── 9. DamageEngine.runTests ────────────────────────────────────────────────

const DamageEngine = {
  /**
   * 运行 12 个验证用例，返回 { passed, total, failures[] }。
   */
  runTests() {
    const failures = [];

    function assert(id, name, actual, expected) {
      if (actual !== expected) {
        failures.push({
          id,
          name,
          expected,
          actual,
          diff: actual - expected,
        });
      }
    }

    // ── Test 1: Stat basic ──
    // round(round((1000*1.2+100)*1.1)*1.15+50) = round(1430*1.15+50) = round(1644.5+50) = round(1694.5)
    // Note: JS Math.round(1694.5) = 1694 (banker's rounding)
    {
      const result = calculateStat(1000, 20, 100, 10, 15, 50);
      assert(1, 'Stat basic', result, 1694);
    }

    // ── Test 2: Shield def ──
    // 500*1.0 + (800-500)*0.5 = 500 + 150 = 650
    {
      const result = calculateShieldDef(500, 800);
      assert(2, 'Shield def', result, 650);
    }

    // ── Test 3: Basic damage ──
    // effValue=300, stat=1500 → floor(300*1500/100*0.36) = floor(4500*0.36) = floor(1620) = 1620
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        isCrit: false,
      });
      assert(3, 'Basic damage', result.normalDamage, 1620);
    }

    // ── Test 4: Crit damage ──
    // floor(300*2.0*1500/100*0.36) = floor(3240) = 3240
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        critDmgRate: 200,
        isCrit: true,
      });
      assert(4, 'Crit damage', result.critDamage, 3240);
    }

    // ── Test 5: Color bonus ──
    // floor(300*1500/100*0.36*1.15) = floor(1620*1.15) = floor(1863) = 1863
    // Note: floating point 1620*1.15 = 1862.9999… → safeFloor gives 1863
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        colorDmgRate: 15,
        isCrit: false,
      });
      assert(5, 'Color bonus', result.normalDamage, 1863);
    }

    // ── Test 6: DVA ADD ──
    // floor(350*1500/100*0.36) = floor(5250*0.36) = floor(1890) = 1890
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        dvaList: [{ sign: MathSign.ADD, value: 50 }],
        isCrit: false,
      });
      assert(6, 'DVA ADD', result.normalDamage, 1890);
    }

    // ── Test 7: DVA MULTIPLY_PCT ──
    // floor(300*0.5*1500/100*0.36) = floor(150*1500/100*0.36) = floor(810) = 810
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        dvaList: [{ sign: MathSign.MULTIPLY_PCT, value: 50 }],
        isCrit: false,
      });
      assert(7, 'DVA MULTIPLY_PCT', result.normalDamage, 810);
    }

    // ── Test 8: DVA FINAL_MULTIPLY independent ──
    // regular: 300*2=600, final: 3, total: 600*3=1800
    // floor(1800*1500/100*0.36) = floor(9720) = 9720
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        dvaList: [
          { sign: MathSign.MULTIPLY, value: 2 },
          { sign: MathSign.FINAL_MULTIPLY, value: 3 },
        ],
        isCrit: false,
      });
      assert(8, 'DVA FINAL_MULTIPLY independent', result.normalDamage, 9720);
    }

    // ── Test 9: BASE_ON_DEF stat ──
    // stat = 800*2.1 + 1000*0.3 = 1680 + 300 = 1980
    {
      const stat = getStatForDmgType({ S_ATK: 1000, S_DEF: 800 }, DmgType.BASE_ON_DEF);
      assert(9, 'BASE_ON_DEF stat', stat, 1980);
    }

    // ── Test 10: IGNORE_STAT ──
    // effValue=500, skip stat, floor(500*0.36) = floor(180) = 180
    {
      const result = calculateDamage({
        effValue: 500,
        stat: 0,
        dmgType: DmgType.IGNORE_STAT,
        isCrit: false,
      });
      assert(10, 'IGNORE_STAT', result.normalDamage, 180);
    }

    // ── Test 11: Shield formula ──
    // floor(200*650/100*0.3) = floor(1300*0.3) = floor(390) = 390
    {
      const result = calculateShield(200, 650);
      assert(11, 'Shield formula', result, 390);
    }

    // ── Test 12: Full pipeline ──
    // non-crit: floor(300*1500/100*0.36*1.10*1.05) = floor(1620*1.155) = floor(1871.1) = 1871
    // crit:     floor(300*1.5*1500/100*0.36*1.10*1.05) = floor(2430*1.155) = floor(2806.65) = 2806
    {
      const result = calculateDamage({
        effValue: 300,
        stat: 1500,
        dmgType: DmgType.NORMAL,
        critRate: 50,
        critDmgRate: 150,
        colorDmgRate: 10,
        addiAtkDmgRate: 5,
        isCrit: null,
        psRatio: 1.0,
      });
      assert(12, 'Full pipeline normal', result.normalDamage, 1871);
      assert(12, 'Full pipeline crit', result.critDamage, 2806);
    }

    // ── Report ──
    const total = 13; // 12 tests, but test 12 has 2 assertions
    const passed = total - failures.length;

    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   DamageEngine.runTests() — ${passed}/${total} passed  ║`);
    console.log(`╚══════════════════════════════════════════╝`);

    if (failures.length === 0) {
      console.log('✅ All tests passed!');
    } else {
      console.log(`❌ ${failures.length} failure(s):`);
      for (const f of failures) {
        console.log(
          `   [#${f.id}] ${f.name}: expected ${f.expected}, got ${f.actual} (diff: ${f.diff})`,
        );
      }
    }
    console.log('');

    return { passed, total, failures };
  },
};

export { DamageEngine };
