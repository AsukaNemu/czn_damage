/**
 * 卡厄思梦境 — 应用控制器
 * 负责 UI 交互、表单读取、结果展示。
 * ES Module 入口（<script type="module" src="./js/app.js">）。
 */

import {
  DmgType,
  MathSign,
  calculateAllStats,
  getStatForDmgType,
  calculateDamage,
  calculateExpectedDamage,
  DamageEngine,
} from './damage-engine.js';
import { generateCritSurface, findOptimalCrit, findOptimalAllocation, findOptimalEquipment, simulateEquipmentRolls } from './optimizer.js';
import { runMonteCarlo } from './monte-carlo.js';
import { renderSurface, renderHeatmap, renderHistogram } from './charts.js';

// ─── DOM 快捷取值 ────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const val = (id) => document.getElementById(id)?.value ?? '';
const num = (id) => parseFloat(val(id)) || 0;

// ─── DVA 解析 ────────────────────────────────────────────────────────────────

const MATHSIGN_MAP = {
  ADD: MathSign.ADD,
  SUBTRACT: MathSign.SUBTRACT,
  MULTIPLY: MathSign.MULTIPLY,
  MULTIPLY_PCT: MathSign.MULTIPLY_PCT,
  ADD_HUND_PCT: MathSign.ADD_HUND_PCT,
  SUB_HUND_PCT: MathSign.SUB_HUND_PCT,
  SET: MathSign.SET,
  FINAL_MULTIPLY: MathSign.FINAL_MULTIPLY,
  FINAL_MULTIPLY_PCT: MathSign.FINAL_MULTIPLY_PCT,
  FINAL_ADD_HUND_PCT: MathSign.FINAL_ADD_HUND_PCT,
};

/**
 * 解析 DVA 文本 → `{ sign, value }[]`。
 * @param {string} text
 * @returns {{ sign: string, value: number }[]}
 */
function parseDVAList(text) {
  if (!text || !text.trim()) return [];
  const list = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, rawVal] = trimmed.split(/\s+/);
    const sign = MATHSIGN_MAP[key?.toUpperCase()];
    if (!sign) continue;
    const value = parseFloat(rawVal);
    if (!isNaN(value)) list.push({ sign, value });
  }
  return list;
}

// ─── 伤害类型映射 ────────────────────────────────────────────────────────────

const DMG_TYPE_MAP = {
  normal: DmgType.NORMAL,
  penetrate: DmgType.PENETRATE,
  fixed: DmgType.FIX,
  defense_mixed: DmgType.BASE_ON_DEF,
  defense_80: DmgType.DEF_80_PCT,
  defense_100: DmgType.DEF_100_PCT,
};

// ─── Tab 切换 ────────────────────────────────────────────────────────────────

function initTabs() {
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // 更新按钮状态
      $$('.tab-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // 切换面板
      $$('.tab-panel').forEach((p) => p.classList.remove('active'));
      const panel = $(`#tab-${target}`);
      if (panel) panel.classList.add('active');
    });
  });

  // 子标签页切换
  $$('.sub-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.subtab;
      const parent = btn.closest('.tab-panel');
      if (!parent) return;

      parent.querySelectorAll('.sub-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      parent.querySelectorAll('.sub-panel').forEach((p) => p.classList.remove('active'));
      const panel = parent.querySelector(`#${target}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// ─── 显示计算过程 ────────────────────────────────────────────────────────────

function renderSteps(steps) {
  const container = $('#calc-steps .calc-steps-content');
  if (!container) return;
  if (!steps || steps.length === 0) {
    container.innerHTML = '<p class="placeholder-text">无计算步骤</p>';
    return;
  }
  container.innerHTML = steps
    .map(
      (s, i) => `
    <div class="step-item">
      <span class="step-num">${i + 1}.</span>
      <strong>${s.step}</strong>
      <span style="color:#888; margin-left:8px;">${s.formula}</span>
      <span style="color:#f0a500; margin-left:8px;">= ${s.value}</span>
      <br><small style="color:#666;">${s.detail}</small>
    </div>`,
    )
    .join('');
}

// ─── 显示伤害结果 ────────────────────────────────────────────────────────────

function displayResult(normal, crit, expected) {
  const rn = $('#result-normal');
  const rc = $('#result-crit');
  const re = $('#result-expected');
  if (rn) rn.textContent = normal.toLocaleString();
  if (rc) rc.textContent = crit.toLocaleString();
  if (re) re.textContent = expected.toLocaleString();
}

// ─── 输入验证 ────────────────────────────────────────────────────────────────

function clearValidation() {
  $$('.invalid').forEach((el) => el.classList.remove('invalid'));
  $$('.error-msg').forEach((el) => el.remove());
}

function markInvalid(inputEl, msg) {
  inputEl.classList.add('invalid');
  const err = document.createElement('span');
  err.className = 'error-msg';
  err.style.cssText = 'color:#ff6b6b;font-size:0.8rem;display:block;margin-top:2px;';
  err.textContent = msg;
  inputEl.parentElement.appendChild(err);
}

function validateBasicForm() {
  clearValidation();
  let valid = true;

  const effEl = document.getElementById('basic-eff-value');
  const atkEl = document.getElementById('basic-atk');
  const crEl = document.getElementById('basic-crit-rate');
  const cdEl = document.getElementById('basic-crit-dmg');

  if (num('basic-eff-value') <= 0) {
    markInvalid(effEl, '技能系数必须 > 0');
    valid = false;
  }
  if (num('basic-atk') <= 0) {
    markInvalid(atkEl, 'ATK 必须 > 0');
    valid = false;
  }
  const cr = num('basic-crit-rate');
  if (cr < 0 || cr > 100) {
    markInvalid(crEl, '暴击率需在 0-100 之间');
    valid = false;
  }
  if (num('basic-crit-dmg') < 100) {
    markInvalid(cdEl, '暴伤倍率需 ≥ 100');
    valid = false;
  }
  return valid;
}

function validateAdvancedForm() {
  clearValidation();
  let valid = true;

  const effEl = document.getElementById('adv-eff-value');
  const atkEl = document.getElementById('adv-base-s-atk');

  if (num('adv-eff-value') <= 0) {
    markInvalid(effEl, '技能系数必须 > 0');
    valid = false;
  }
  if (num('adv-base-s-atk') <= 0) {
    markInvalid(atkEl, '基础 ATK 必须 > 0');
    valid = false;
  }
  return valid;
}

// ─── 基础模式计算 ────────────────────────────────────────────────────────────

function handleBasicCalc() {
  if (!validateBasicForm()) return;

  const effValue = num('basic-eff-value');
  const atk = num('basic-atk');
  const def = num('basic-def');
  const critRate = num('basic-crit-rate');
  const critDmgRate = num('basic-crit-dmg');
  const colorDmgRate = num('basic-element-bonus');
  const addiAtkDmgRate = num('basic-extra-atk-bonus');
  const dmgType = DMG_TYPE_MAP[val('basic-dmg-type')] ?? DmgType.NORMAL;
  const dvaList = parseDVAList(val('basic-dva-list'));

  // 根据伤害类型计算实际 stat（支持基于防御的伤害）
  const statValue = getStatForDmgType({ S_ATK: atk, S_DEF: def }, dmgType);

  const result = calculateDamage({
    effValue,
    stat: statValue,
    dmgType,
    critRate,
    critDmgRate,
    colorDmgRate,
    addiAtkDmgRate,
    dvaList,
    psRatio: 1.0,
  });

  displayResult(result.normalDamage, result.critDamage, result.expectedDamage);
  renderSteps(result.steps);
}

// ─── 进阶模式计算 ────────────────────────────────────────────────────────────

function handleAdvancedCalc() {
  if (!validateAdvancedForm()) return;

  const effValue = num('adv-eff-value');
  const dmgType = DMG_TYPE_MAP[val('adv-dmg-type')] ?? DmgType.NORMAL;
  const dvaList = parseDVAList(val('adv-dva-list'));

  // 基础属性
  const baseStat = {
    atk: num('adv-base-s-atk'),
    def: num('adv-base-s-def'),
    hp: num('adv-base-s-hp'),
  };

  // 局外加成
  const outBonus = {
    atkRate: num('adv-out-atk-rate'),
    atkAdd: num('adv-out-atk-add'),
    defRate: num('adv-out-def-rate'),
    defAdd: num('adv-out-def-add'),
    hpRate: num('adv-out-hp-rate'),
    hpAdd: num('adv-out-hp-add'),
  };

  // 局内加成
  const inBonus = {
    atkRate: num('adv-in-atk-rate'),
    atkAdd: num('adv-in-atk-add'),
    atkCal: num('adv-in-atk-cal'),
    defRate: num('adv-in-def-rate'),
    defAdd: num('adv-in-def-add'),
    defCal: num('adv-in-def-cal'),
    hpRate: num('adv-in-hp-rate'),
    hpAdd: num('adv-in-hp-add'),
    hpCal: num('adv-in-hp-cal'),
  };

  const critRate = num('adv-crit-rate');
  const critDmgRate = num('adv-crit-dmg');
  const colorDmgRate = num('adv-element-bonus');
  const addiAtkDmgRate = num('adv-extra-atk-bonus');

  const stats = calculateAllStats(baseStat, outBonus, inBonus);
  const statValue = getStatForDmgType(stats, dmgType);

  const result = calculateDamage({
    effValue,
    stat: statValue,
    dmgType,
    critRate,
    critDmgRate,
    colorDmgRate,
    addiAtkDmgRate,
    dvaList,
    psRatio: 1.0,
  });

  displayResult(result.normalDamage, result.critDamage, result.expectedDamage);
  renderSteps(result.steps);
}

// ─── 最优分析 ────────────────────────────────────────────────────────────────

let lastSurfaceData = null;

function handleOptGenerate() {
  const effValue = num('opt-eff-value');
  const atk = num('opt-atk');
  const colorDmgRate = num('opt-element-bonus');
  const addiAtkDmgRate = num('opt-extra-atk-bonus');
  const dmgType = DMG_TYPE_MAP[val('opt-dmg-type')] ?? DmgType.NORMAL;

  if (effValue <= 0 || atk <= 0) {
    alert('技能系数和 ATK 必须 > 0');
    return;
  }

  const baseInput = {
    effValue,
    stat: atk,
    dmgType,
    colorDmgRate,
    addiAtkDmgRate,
    dvaList: [],
    psRatio: 1.0,
  };

  const btn = $('#btn-opt-generate');
  btn.disabled = true;
  btn.textContent = '计算中…';

  // 使用 setTimeout 让 UI 有时间更新
  setTimeout(() => {
    try {
      const surfaceData = generateCritSurface(baseInput);
      lastSurfaceData = surfaceData;

      const containerId = 'crit-surface-chart';
      const useHeatmap = document.getElementById('opt-chart-toggle')?.checked;
      if (useHeatmap) {
        renderHeatmap(containerId, surfaceData);
      } else {
        renderSurface(containerId, surfaceData);
      }

      // 显示最优点信息
      const mp = surfaceData.maxPoint;
      const chartEl = document.getElementById(containerId);
      let infoEl = document.getElementById('opt-max-info');
      if (!infoEl) {
        infoEl = document.createElement('div');
        infoEl.id = 'opt-max-info';
        infoEl.style.cssText = 'margin-top:12px;text-align:center;color:#f0a500;';
        chartEl.parentElement.appendChild(infoEl);
      }
      infoEl.innerHTML =
        `<strong>最优解：</strong>暴击率 ${mp.critRate}% | 暴伤倍率 ${mp.critDmgRate}% | 期望伤害 <strong>${mp.expectedDamage.toLocaleString()}</strong>`;
    } catch (e) {
      console.error('最优分析计算失败:', e);
      alert('计算出错: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '生成曲面图';
    }
  }, 50);
}

// ─── 有限资源约束优化 ──────────────────────────────────────────────────────

let lastAllocationData = null;

function handleConstrainedOpt() {
  const effValue = num('oc-eff-value');
  const atk = num('oc-atk');
  const baseCritRate = num('oc-base-crit-rate');
  const baseCritDmg = num('oc-base-crit-dmg');
  const totalPoints = num('oc-total-points');
  const critRatePerPoint = num('oc-rate-per-point');
  const critDmgPerPoint = num('oc-dmg-per-point');
  const colorDmgRate = num('oc-element-bonus');
  const addiAtkDmgRate = num('oc-extra-atk-bonus');
  const dmgType = DMG_TYPE_MAP[val('oc-dmg-type')] ?? DmgType.NORMAL;

  if (effValue <= 0 || atk <= 0) {
    alert('技能系数和 ATK 必须 > 0');
    return;
  }
  if (totalPoints <= 0) {
    alert('可分配属性点必须 > 0');
    return;
  }

  const baseInput = {
    effValue,
    stat: atk,
    dmgType,
    colorDmgRate,
    addiAtkDmgRate,
    dvaList: [],
    psRatio: 1.0,
  };

  const btn = $('#btn-oc-calc');
  btn.disabled = true;
  btn.textContent = '计算中…';

  setTimeout(() => {
    try {
      const result = findOptimalAllocation(baseInput, {
        baseCritRate,
        baseCritDmg,
        totalPoints,
        critRatePerPoint,
        critDmgPerPoint,
      });

      lastAllocationData = result;

      // 显示结果
      const resultPanel = $('#oc-result');
      resultPanel.style.display = 'block';
      $('#oc-res-rate').textContent = result.optimalCritRate.toFixed(1) + '%';
      $('#oc-res-dmg').textContent = result.optimalCritDmg.toFixed(1) + '%';
      $('#oc-res-points-rate').textContent = result.pointsIntoRate + ' 点';
      $('#oc-res-points-dmg').textContent = result.pointsIntoDmg + ' 点';
      $('#oc-res-expected').textContent = Math.floor(result.expectedDamage).toLocaleString();

      // 渲染分配曲线图
      renderAllocationCurve('oc-curve-chart', result, baseCritRate, baseCritDmg, critRatePerPoint, critDmgPerPoint, totalPoints);

    } catch (e) {
      console.error('约束优化计算失败:', e);
      alert('计算出错: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '计算最优分配';
    }
  }, 50);
}

function renderAllocationCurve(containerId, result, baseRate, baseDmg, ratePerPt, dmgPerPt, totalPts) {
  const x = result.curve.map(p => p.pointsIntoRate);
  const yDmg = result.curve.map(p => p.expectedDamage);
  const yRate = result.curve.map(p => p.critRate);
  const yCritDmg = result.curve.map(p => p.critDmg);

  const colors = {
    primary: '#f0a500',
    secondary: '#4a9eff',
    bg: 'rgba(26,26,46,0.95)',
    grid: 'rgba(255,255,255,0.08)',
    text: '#e0e0e0',
  };

  Plotly.newPlot(containerId, [
    {
      x, y: yDmg,
      type: 'scatter',
      mode: 'lines+markers',
      name: '期望伤害',
      line: { color: colors.primary, width: 3 },
      marker: { size: 6, color: colors.primary },
      yaxis: 'y',
    },
    {
      x, y: yRate,
      type: 'scatter',
      mode: 'lines',
      name: '暴击率 (%)',
      line: { color: '#ff6b6b', width: 1.5, dash: 'dot' },
      yaxis: 'y2',
    },
    {
      x, y: yCritDmg,
      type: 'scatter',
      mode: 'lines',
      name: '暴伤 (%)',
      line: { color: '#4a9eff', width: 1.5, dash: 'dot' },
      yaxis: 'y2',
    },
  ], {
    paper_bgcolor: colors.bg,
    plot_bgcolor: colors.bg,
    font: { color: colors.text },
    title: { text: `属性点分配曲线（共 ${totalPts} 点）`, font: { color: colors.primary } },
    xaxis: {
      title: '分配给暴击率的点数',
      gridcolor: colors.grid,
      tickmode: 'linear',
      dtick: Math.max(1, Math.floor(totalPts / 20)),
    },
    yaxis: {
      title: '期望伤害',
      titlefont: { color: colors.primary },
      gridcolor: colors.grid,
      side: 'left',
    },
    yaxis2: {
      title: '百分比 (%)',
      titlefont: { color: '#888' },
      gridcolor: 'transparent',
      side: 'right',
      overlaying: 'y',
    },
    legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(0,0,0,0.3)' },
    margin: { t: 50, r: 60, b: 50, l: 60 },
    // 标注最优点
    annotations: [{
      x: result.pointsIntoRate,
      y: result.expectedDamage,
      text: `最优: ${result.pointsIntoRate}点给暴击率`,
      showarrow: true,
      arrowhead: 2,
      arrowcolor: colors.primary,
      font: { color: colors.primary, size: 12 },
      bgcolor: 'rgba(0,0,0,0.7)',
      bordercolor: colors.primary,
    }],
  }, { responsive: true });
}

// ─── 装备词条优化 ──────────────────────────────────────────────────────────

function handleEquipmentOpt() {
  const effValue = num('eq-eff-value');
  const atk = num('eq-atk');
  const baseCritRate = num('eq-base-crit-rate');
  const baseCritDmg = num('eq-base-crit-dmg');
  const totalRolls = num('eq-total-rolls');
  const critRateMain = num('eq-crit-rate-main');
  const critDmgMain = num('eq-crit-dmg-main');
  const critRatePerRoll = num('eq-rate-per-roll');
  const critDmgPerRoll = num('eq-dmg-per-roll');
  const critHitRate = num('eq-crit-hit-rate') / 100;  // 百分比转小数
  const colorDmgRate = num('eq-element-bonus');
  const addiAtkDmgRate = num('eq-extra-atk-bonus');
  const dmgType = DMG_TYPE_MAP[val('eq-dmg-type')] ?? DmgType.NORMAL;

  if (effValue <= 0 || atk <= 0) {
    alert('技能系数和 ATK 必须 > 0');
    return;
  }

  const baseInput = {
    effValue, stat: atk, dmgType, colorDmgRate, addiAtkDmgRate,
    dvaList: [], psRatio: 1.0,
  };

  const btn = $('#btn-eq-calc');
  btn.disabled = true;
  btn.textContent = '计算中…';

  setTimeout(() => {
    try {
      const result = findOptimalEquipment(baseInput, {
        baseCritRate, baseCritDmg, totalRolls,
        critRateMain, critDmgMain, critRatePerRoll, critDmgPerRoll, critHitRate,
      });

      // 显示推荐
      const recDiv = $('#eq-recommend');
      const r = result.bestOverall;
      const wasted = r.wastedRolls || (totalRolls - result.effectiveRolls);
      recDiv.innerHTML = `
        <h3>推荐方案</h3>
        <div class="result-row"><span class="result-label">主词条</span><span class="result-value">${r.mainStat}</span></div>
        <div class="result-row"><span class="result-label">总强化次数</span><span class="result-value">${totalRolls} 次（命中 ${result.effectiveRolls} 次，歪了 ${wasted} 次）</span></div>
        <div class="result-row"><span class="result-label">副词条: 暴击率</span><span class="result-value">${r.subRateRolls} 次强化</span></div>
        <div class="result-row"><span class="result-label">副词条: 暴伤</span><span class="result-value">${r.subDmgRolls} 次强化</span></div>
        <div class="result-row"><span class="result-label">最终暴击率</span><span class="result-value">${r.critRate}%</span></div>
        <div class="result-row"><span class="result-label">最终暴伤</span><span class="result-value">${r.critDmg}%</span></div>
        <div class="result-row"><span class="result-label">期望伤害</span><span class="result-value" style="color:#ff6b6b;font-size:1.4rem;">${r.expectedDamage.toLocaleString()}</span></div>
      `;

      // 左侧: 暴击率主词条
      const o1 = result.mainCritRate.optimal;
      $('#eq-rate-summary').innerHTML = `
        <div style="color:#f0a500;margin-bottom:8px;">
          最优: ${o1.subRateRolls}次暴击/${o1.subDmgRolls}次暴伤 → ${o1.critRate}%暴击 / ${o1.critDmg}%暴伤
        </div>
        <div style="font-size:1.3rem;font-weight:bold;margin-bottom:8px;">
          期望伤害: ${o1.expectedDamage.toLocaleString()}
        </div>
      `;
      renderEquipCurve('eq-rate-chart', result.mainCritRate.curve, o1, totalRolls);

      // 右侧: 暴伤主词条
      const o2 = result.mainCritDmg.optimal;
      $('#eq-dmg-summary').innerHTML = `
        <div style="color:#f0a500;margin-bottom:8px;">
          最优: ${o2.subRateRolls}次暴击/${o2.subDmgRolls}次暴伤 → ${o2.critRate}%暴击 / ${o2.critDmg}%暴伤
        </div>
        <div style="font-size:1.3rem;font-weight:bold;margin-bottom:8px;">
          期望伤害: ${o2.expectedDamage.toLocaleString()}
        </div>
      `;
      renderEquipCurve('eq-dmg-chart', result.mainCritDmg.curve, o2, totalRolls);

      // 蒙特卡洛随机强化模拟
      const best = result.bestOverall;
      const simResult = simulateEquipmentRolls(baseInput, {
        baseCritRate, baseCritDmg, critRateMain, critDmgMain,
        critRateMin: 1.2, critRateMax: 2.0,
        critDmgMin: 2.4, critDmgMax: 4.0,
        subRateRolls: best.subRateRolls,
        subDmgRolls: best.subDmgRolls,
        totalRolls, critHitRate,
        mainStat: result.recommendation === 'critRate' ? 'critRate' : 'critDmg',
        iterations: 10000,
      });

      // 显示统计摘要
      const d = simResult.damage;
      const cr = simResult.critRate;
      const cd = simResult.critDmg;
      const hc = simResult.hitCount;
      $('#eq-mc-stats').innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; text-align:center;">
          <div><div style="color:#888;font-size:0.8rem;">命中次数</div><div style="color:#f0a500;font-size:1.1rem;">${hc.p5} ~ ${hc.p95}</div><div style="color:#666;font-size:0.75rem;">中位数 ${hc.median} / ${totalRolls}</div></div>
          <div><div style="color:#888;font-size:0.8rem;">暴击率范围</div><div style="color:#f0a500;font-size:1.1rem;">${cr.p5}% ~ ${cr.p95}%</div><div style="color:#666;font-size:0.75rem;">中位数 ${cr.median}%</div></div>
          <div><div style="color:#888;font-size:0.8rem;">暴伤范围</div><div style="color:#f0a500;font-size:1.1rem;">${cd.p5}% ~ ${cd.p95}%</div><div style="color:#666;font-size:0.75rem;">中位数 ${cd.median}%</div></div>
          <div><div style="color:#888;font-size:0.8rem;">期望伤害范围</div><div style="color:#ff6b6b;font-size:1.1rem;">${d.p5.toLocaleString()} ~ ${d.p95.toLocaleString()}</div><div style="color:#666;font-size:0.75rem;">中位数 ${d.median.toLocaleString()}</div></div>
        </div>
      `;

      // 渲染伤害分布直方图
      const mcColors = { primary: '#f0a500', bg: 'rgba(26,26,46,0.95)', grid: 'rgba(255,255,255,0.08)', text: '#e0e0e0' };
      Plotly.newPlot('eq-mc-chart', [{
        x: simResult.samples.map(s => s.damage),
        type: 'histogram',
        marker: { color: 'rgba(240,165,0,0.6)', line: { color: '#f0a500', width: 1 } },
        nbinsx: 40,
      }], {
        paper_bgcolor: mcColors.bg,
        plot_bgcolor: mcColors.bg,
        font: { color: mcColors.text, size: 10 },
        title: { text: '10000次随机强化 → 期望伤害分布', font: { color: mcColors.primary, size: 13 } },
        xaxis: { title: '期望伤害', gridcolor: mcColors.grid },
        yaxis: { title: '次数', gridcolor: mcColors.grid },
        margin: { t: 40, r: 20, b: 50, l: 50 },
        annotations: [
          { x: d.median, y: 0, text: `中位数: ${d.median.toLocaleString()}`, showarrow: true, arrowhead: 2, arrowcolor: '#ff6b6b', font: { color: '#ff6b6b', size: 10 }, ax: 0, ay: -30 },
          { x: d.mean, y: 0, text: `均值: ${d.mean.toLocaleString()}`, showarrow: true, arrowhead: 2, arrowcolor: '#4a9eff', font: { color: '#4a9eff', size: 10 }, ax: 0, ay: -50 },
        ],
      }, { responsive: true, displayModeBar: false });

      $('#eq-result').style.display = 'block';
    } catch (e) {
      console.error('装备优化计算失败:', e);
      alert('计算出错: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '计算最优装备方案';
    }
  }, 50);
}

function renderEquipCurve(containerId, curve, optimal, totalRolls) {
  const x = curve.map(p => p.subRateRolls);
  const y = curve.map(p => p.expectedDamage);

  const colors = { primary: '#f0a500', bg: 'rgba(26,26,46,0.95)', grid: 'rgba(255,255,255,0.08)', text: '#e0e0e0' };

  Plotly.newPlot(containerId, [{
    x, y,
    type: 'scatter',
    mode: 'lines+markers',
    hovertext: curve.map(p => `暴击${p.subRateRolls}次/暴伤${p.subDmgRolls}次<br>${p.critRate}%暴击/${p.critDmg}%暴伤<br>伤害: ${p.expectedDamage.toLocaleString()}`),
    hoverinfo: 'text',
    line: { color: colors.primary, width: 2 },
    marker: {
      size: curve.map(p => p.subRateRolls === optimal.subRateRolls ? 10 : 3),
      color: curve.map(p => p.subRateRolls === optimal.subRateRolls ? '#ff4444' : colors.primary),
    },
  }], {
    paper_bgcolor: colors.bg,
    plot_bgcolor: colors.bg,
    font: { color: colors.text, size: 10 },
    xaxis: { title: '暴击率强化次数', gridcolor: colors.grid, range: [-1, totalRolls + 1] },
    yaxis: { title: '期望伤害', gridcolor: colors.grid },
    margin: { t: 10, r: 20, b: 40, l: 60 },
    annotations: [{
      x: optimal.subRateRolls, y: optimal.expectedDamage,
      text: `${optimal.expectedDamage.toLocaleString()}`,
      showarrow: true, arrowhead: 2, arrowcolor: '#ff4444',
      font: { color: '#ff4444', size: 11 },
      bgcolor: 'rgba(0,0,0,0.7)', bordercolor: '#ff4444',
      ax: 0, ay: -25,
    }],
  }, { responsive: true, displayModeBar: false });
}

// ─── 蒙特卡洛 ────────────────────────────────────────────────────────────────

function handleMonteCarlo() {
  const effValue = num('mc-eff-value');
  const atk = num('mc-atk');
  const critRate = num('mc-crit-rate');
  const critDmgRate = num('mc-crit-dmg');
  const colorDmgRate = num('mc-element-bonus');
  const addiAtkDmgRate = num('mc-extra-atk-bonus');
  const dmgType = DMG_TYPE_MAP[val('mc-dmg-type')] ?? DmgType.NORMAL;
  const iterations = parseInt(val('mc-sim-count')) || 10000;
  const seedRaw = val('mc-seed');
  const seed = seedRaw !== '' ? parseInt(seedRaw) : null;

  if (effValue <= 0 || atk <= 0) {
    alert('技能系数和 ATK 必须 > 0');
    return;
  }

  const damageInput = {
    effValue,
    stat: atk,
    dmgType,
    critRate,
    critDmgRate,
    colorDmgRate,
    addiAtkDmgRate,
    dvaList: [],
    psRatio: 1.0,
  };

  const btn = $('#btn-mc-start');
  btn.disabled = true;
  btn.textContent = '模拟中…';

  setTimeout(() => {
    try {
      const result = runMonteCarlo(damageInput, iterations, seed);

      // 统计卡片
      const statsEl = document.getElementById('monte-carlo-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${result.mean.toFixed(1)}</div>
              <div class="stat-label">均值伤害</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${result.median.toFixed(1)}</div>
              <div class="stat-label">中位数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${result.p25.toFixed(1)}</div>
              <div class="stat-label">25 百分位</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${result.p75.toFixed(1)}</div>
              <div class="stat-label">75 百分位</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${(result.actualCritRate * 100).toFixed(2)}%</div>
              <div class="stat-label">实际暴击率</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${iterations.toLocaleString()}</div>
              <div class="stat-label">模拟次数</div>
            </div>
          </div>`;
      }

      // 直方图
      renderHistogram('monte-carlo-chart', result.distribution, {
        mean: result.mean,
        median: result.median,
      });
    } catch (e) {
      console.error('蒙特卡洛模拟失败:', e);
      alert('模拟出错: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '开始模拟';
    }
  }, 50);
}

// ─── 配置对比 ────────────────────────────────────────────────────────────────

function serializeCurrentResult() {
  return JSON.stringify({
    normal: $('#result-normal')?.textContent ?? '—',
    crit: $('#result-crit')?.textContent ?? '—',
    expected: $('#result-expected')?.textContent ?? '—',
    timestamp: new Date().toLocaleString(),
  });
}

function displayCompare(slotId, data) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  const content = slot.querySelector('.compare-content');
  if (!content) return;
  if (!data) {
    content.textContent = '未保存';
    return;
  }
  content.innerHTML = `
    <div>非暴击: <strong>${data.normal}</strong></div>
    <div>暴击: <strong>${data.crit}</strong></div>
    <div>期望: <strong>${data.expected}</strong></div>
    <small style="color:#666;">${data.timestamp}</small>`;
}

function saveConfig(slot) {
  const data = serializeCurrentResult();
  localStorage.setItem(`czn_config_${slot}`, data);
  displayCompare(`compare-${slot}`, JSON.parse(data));
}

function loadConfig(slot) {
  const raw = localStorage.getItem(`czn_config_${slot}`);
  if (!raw) {
    alert(`配置 ${slot.toUpperCase()} 尚未保存`);
    return;
  }
  displayCompare(`compare-${slot}`, JSON.parse(raw));
}

// ─── 初始化 ──────────────────────────────────────────────────────────────────

function init() {
  initTabs();

  // 计算按钮
  document.getElementById('btn-basic-calc')?.addEventListener('click', handleBasicCalc);
  document.getElementById('btn-adv-calc')?.addEventListener('click', handleAdvancedCalc);
  document.getElementById('btn-opt-generate')?.addEventListener('click', handleOptGenerate);
  document.getElementById('btn-oc-calc')?.addEventListener('click', handleConstrainedOpt);
  document.getElementById('btn-eq-calc')?.addEventListener('click', handleEquipmentOpt);
  document.getElementById('btn-mc-start')?.addEventListener('click', handleMonteCarlo);

  // 配置对比
  document.getElementById('btn-save-config-a')?.addEventListener('click', () => saveConfig('a'));
  document.getElementById('btn-save-config-b')?.addEventListener('click', () => saveConfig('b'));
  document.getElementById('btn-load-config-a')?.addEventListener('click', () => loadConfig('a'));
  document.getElementById('btn-load-config-b')?.addEventListener('click', () => loadConfig('b'));

  // 曲面图/热力图切换时重新渲染
  document.getElementById('opt-chart-toggle')?.addEventListener('change', () => {
    if (!lastSurfaceData) return;
    const containerId = 'crit-surface-chart';
    const useHeatmap = document.getElementById('opt-chart-toggle')?.checked;
    if (useHeatmap) {
      renderHeatmap(containerId, lastSurfaceData);
    } else {
      renderSurface(containerId, lastSurfaceData);
    }
  });
}

// DOMContentLoaded 或直接执行（ES module 默认 defer）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
