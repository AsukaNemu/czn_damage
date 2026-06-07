# 卡厄思梦境 · 伤害计算器 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于《卡厄思梦境》代码层伤害公式，构建浏览器端伤害计算器，支持基础/进阶模式、最优暴击区间分析和蒙特卡洛模拟。

**Architecture:** 多文件静态站（无构建工具），伤害引擎纯函数独立可测，Plotly.js 渲染 3D 曲面图和直方图。

**Tech Stack:** HTML5 + CSS3 + Vanilla JS (ES Modules) + Plotly.js (CDN)

**Design Spec:** `docs/superpowers/specs/2026-06-06-czn-damage-calculator-design.md`

---

## Task 1: 项目骨架 + 全局常量

**Files:**
- Create: `data/constants.json`
- Create: `index.html`

- [ ] **Step 1: 创建 constants.json**

```json
{
  "dmg_revise_rate": 0.36,
  "shield_revise_rate": 0.3,
  "dmg_decrease_rate_0_value": -160,
  "dmg_decrease_rate_curv_value": 300,
  "rage_base": 1.1,
  "rage_scale": 1.25,
  "battle_rage_turn": 5,
  "elite_rage_turn": 7,
  "boss_rage_turn": 10,
  "shield_cal_rate_for_base_def": 1.0,
  "shield_cal_rate_for_add_def": 0.5
}
```

- [ ] **Step 2: 创建 index.html 骨架**

包含：DOCTYPE、charset、viewport、title、CDN 引入 Plotly.js、ES Module 引入所有 JS 文件、四个标签页面板（基础/进阶/最优分析/蒙特卡洛）、输入表单、结果区域。

- [ ] **Step 3: 在浏览器中打开验证页面结构**

---

## Task 2: 伤害引擎核心 (damage-engine.js)

**Files:**
- Create: `js/damage-engine.js`

- [ ] **Step 1: 定义常量枚举**

DmgType (17种伤害类型)、MathSign (10种DVA操作)。

- [ ] **Step 2: 实现属性计算函数**

```javascript
function calculateStat(base, outRate, outAdd, cal, inRate, inAdd)
function calculateShieldDef(baseDef, totalDef)
function calculateAllStats(baseStat, outBonus, inBonus)
```

- [ ] **Step 3: 实现 DVA 操作函数**

```javascript
function applyDVA(baseValue, dvaList)
// FINAL 系列独立乘区，不与常规倍率合并
```

- [ ] **Step 4: 实现伤害计算主函数**

```javascript
function calculateDamage(input)
// 10步流程: eff_value → calcValue → PS → DVA → 暴击 → stat乘法 → 0.36修正 → 颜色 → 追加 → 返回
```

- [ ] **Step 5: 实现护盾和治愈计算**

```javascript
function calculateShield(input)  // eff_value × DEF_SHIELD / 100 × 0.3
function calculateHeal(input)    // 类似但无 revise
```

- [ ] **Step 6: 实现内置测试函数**

```javascript
DamageEngine.runTests()
// 12个测试用例覆盖所有公式分支
```

- [ ] **Step 7: 在浏览器控制台运行测试验证**

---

## Task 3: 蒙特卡洛模拟 (monte-carlo.js)

**Files:**
- Create: `js/monte-carlo.js`

- [ ] **Step 1: 实现 seeded RNG**

Mulberry32 算法，支持可复现随机数。

- [ ] **Step 2: 实现模拟函数**

```javascript
function runMonteCarlo(damageInput, iterations, seed)
// 返回 { mean, median, p25, p75, maxCrit, minNonCrit, critRate, distribution[] }
```

- [ ] **Step 3: 用简单用例验证统计结果合理性**

---

## Task 4: 最优分析 (optimizer.js)

**Files:**
- Create: `js/optimizer.js`

- [ ] **Step 1: 实现网格扫描函数**

```javascript
function generateCritSurface(damageInput, critRateRange, critDmgRange)
// 暴击率 0~100 步长1, 暴伤 100~300 步长2
// 返回 { x[], y[], z[][] } 用于 Plotly surface
```

- [ ] **Step 2: 验证网格计算结果**

---

## Task 5: UI 样式 (style.css)

**Files:**
- Create: `css/style.css`

- [ ] **Step 1: 实现游戏原生暗色风格**

深色渐变背景、金/琥珀强调色、卡片发光边框、标签页切换、输入框样式、响应式布局。

---

## Task 6: 图表 + 应用控制器 (charts.js + app.js)

**Files:**
- Create: `js/charts.js`
- Create: `js/app.js`

- [ ] **Step 1: charts.js — Plotly 封装**

```javascript
function renderSurface(containerId, surfaceData)
function renderHistogram(containerId, distribution)
```

- [ ] **Step 2: app.js — UI 控制器**

标签页切换、表单读取、模式切换（基础/进阶）、按钮事件绑定、结果渲染、计算过程展示。

- [ ] **Step 3: 配置对比功能**

两个结果面板并排，localStorage 保存/加载。

- [ ] **Step 4: 浏览器端到端验证**

---

## Task 7: 端到端验证

- [ ] **Step 1: 完整流程测试 — 基础模式**
- [ ] **Step 2: 完整流程测试 — 进阶模式**
- [ ] **Step 3: 完整流程测试 — 最优分析曲面图**
- [ ] **Step 4: 完整流程测试 — 蒙特卡洛直方图**
- [ ] **Step 5: 公式验证 — 与游戏实际数值对比**
