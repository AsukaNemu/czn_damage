# 卡厄思梦境 · 伤害计算器 设计文档

日期: 2026-06-06
来源: NGA 帖子 tid=46932958（代码层面伤害资料）

## 概述

基于《卡厄思梦境》代码层面的伤害公式，构建一个浏览器端伤害计算器。支持基础/进阶两种输入模式，提供伤害计算、计算过程展示、最优暴击区间分析、蒙特卡洛模拟和配置对比功能。

## 技术方案

**方案 B：多文件静态站（模块化）**

- 纯 HTML/CSS/JS，无构建工具
- 浏览器直接打开（需本地服务器处理 ES Module）
- Plotly.js 通过 CDN 引入，用于 3D 曲面图
- 界面语言：纯中文
- 视觉风格：游戏原生暗色风格

## 项目结构

```
czn_damage/
├── index.html              # 主页面
├── css/
│   └── style.css           # 游戏原生风格样式
├── js/
│   ├── damage-engine.js    # 伤害计算引擎（纯函数，无 DOM 依赖）
│   ├── optimizer.js        # 最优暴击区间计算
│   ├── monte-carlo.js      # 蒙特卡洛暴击模拟
│   ├── charts.js           # Plotly 图表封装
│   └── app.js              # UI 控制器
├── data/
│   └── constants.json      # 全局常量
└── docs/
    └── superpowers/specs/  # 设计文档
```

## 模块职责

| 模块 | 职责 | 依赖 |
|------|------|------|
| `damage-engine.js` | 属性计算、伤害公式、DVA修饰、暴击判定 | `constants.json` |
| `optimizer.js` | 暴击率×暴伤二维网格扫描，输出期望伤害矩阵 | `damage-engine.js` |
| `monte-carlo.js` | N次随机攻击模拟，输出统计分布 | `damage-engine.js` |
| `charts.js` | 封装 Plotly 调用，渲染曲面图/直方图 | Plotly CDN |
| `app.js` | 读取表单 → 调用引擎 → 渲染结果 | 以上全部 |

`damage-engine.js` 零 DOM 依赖，纯输入→输出函数，可在浏览器控制台独立测试。

## 伤害引擎设计 (`damage-engine.js`)

### 属性计算

```
calculateStat(base, outRate%, outAdd, cal%, inRate%, inAdd)
  → round( round((base * (1 + outRate/100) + outAdd) * (1 + cal/100)) * (1 + inRate/100) + inAdd )
```

输入接口：

```javascript
{
  baseStat: { atk, def, hp },
  outBonus: { atkRate, atkAdd, defRate, defAdd, hpRate, hpAdd },
  inBonus:  { atkRate, atkAdd, atkCal, defRate, defAdd, defCal, hpRate, hpAdd, hpCal }
}
→ { S_ATK, S_DEF, S_HP, S_DEF_SHIELD }
```

### 护盾防御

```
S_DEF_SHIELD = baseDef * 1.0 + (totalDef - baseDef) * 0.5
```

### 伤害计算流程

1. eff_value（技能系数）
2. calcValue() — 值类型转换（HP百分比、cost乘法、buff/debuff数量等）
3. PS倍率 — ps_ratio = revise/default_revise × ps_offset
4. DVA修饰 — 遍历 plus/multi/set/final 操作
5. 暴击判定 — critRate vs 随机数，暴击时 × critDmgRate
6. 属性乘法 — value × stat / 100
7. 修正乘法 — floor(value × 0.36)
8. 属性颜色克制 — value *= (1 + colorDmgRate/100)
9. 追加攻击修正 — value *= (1 + addiAtkRate/100)

### stat 取值

| 标志 | stat 值 |
|------|---------|
| 默认（无标志） | S_ATK |
| DMG_ATTR_BASE_ON_DEF | S_DEF × 2.1 + S_ATK × 0.3 |
| DMG_ATTR_DEF_80_PCT | S_DEF × 0.8 + S_ATK × 0.2 |
| DMG_ATTR_DEF_100_PCT | S_DEF |
| DMG_ATTR_IGNORE_STAT | 不做属性乘法（固定伤害） |

### DVA 操作

| 符号 | 操作 | 示例 |
|------|------|------|
| MATHSIGN_ADD | 加法 | +20 |
| MATHSIGN_SUBTRACT | 减法 | -20 |
| MATHSIGN_MULTIPLY | 乘法 | ×20 |
| MATHSIGN_MULTIPLY_PCT | 百分比乘法 | ×0.2 |
| MATHSIGN_ADD_HUND_MULTIPLY_PCT | (100+值)% | ×1.2 |
| MATHSIGN_SUBTRACT_HUND_MULTIPLY_PCT | (100-值)% | ×0.8 |
| MATHSIGN_SET | 设定值（覆盖） | =20 |
| MATHSIGN_FINAL_MULTIPLY | 最终乘法（独立乘区） | ×20 |
| MATHSIGN_FINAL_MULTIPLY_PCT | 最终百分比乘法（独立乘区） | ×0.2 |
| MATHSIGN_FINAL_ADD_HUND_MULTIPLY_PCT | 最终(100+值)%（独立乘区） | ×1.2 |

FINAL 系列和 <1 的乘法系数是独立乘区，不与其他常规倍率合并。

### 伤害类型（17种）

- DMG_ATTR_NORMAL: 普通伤害
- DMG_ATTR_PENETRATE: 贯穿伤害（直接扣HP，不经护盾）
- DMG_ATTR_FIX: 固定伤害
- DMG_ATTR_IGNORE_STAT: 忽略属性（不使用ATK）
- DMG_ATTR_IGNORE_REVISE: 忽略全局修正系数
- DMG_ATTR_IGNORE_BLOCK: 忽略格挡类被动
- DMG_ATTR_IGNORE_RAGE: 忽略愤怒减伤
- DMG_ATTR_BASE_ON_DEF: 基于防御（混合公式）
- DMG_ATTR_DEF_80_PCT: 基于80%防御
- DMG_ATTR_DEF_100_PCT: 基于100%防御
- DMG_ATTR_NO_STAT_CRI: 非属性暴击
- DMG_ATTR_ADDITIONAL_ATTACK: 追加攻击
- DMG_ATTR_DOT_ATTACK: DOT持续伤害
- DMG_ATTR_LEECH_HP / LEECH_HP_PCT: HP吸血
- DMG_ATTR_LEECH_SHIELD / LEECH_SHIELD_PCT: 护盾吸血
- DMG_ATTR_AUTO: 自动伤害
- DMG_ATTR_EGO_FIELD_0: 韧性伤害

### 全局常量

| 常量 | 值 | 说明 |
|------|------|------|
| dmg_revise_rate | 0.36 | 全局伤害修正系数（曾为0.35） |
| shield_revise_rate | 0.3 | 全局护盾修正系数 |
| dmg_decrease_rate_0_value | -160 | 受击减伤基础值 |
| dmg_decrease_rate_curv_value | 300 | 受击减伤曲线值 |
| rage_base | 1.1 | Rage基础倍率 |
| rage_scale | 1.25 | Rage加成倍率 |
| battle_rage_turn | 5 | 普通Rage触发回合 |
| elite_rage_turn | 7 | 精英Rage触发回合 |
| boss_rage_turn | 10 | Boss Rage触发回合 |
| shield_cal_rate_for_base_def | 1.0 | 护盾-基础防御系数 |
| shield_cal_rate_for_add_def | 0.5 | 护盾-额外防御系数 |

### 防御减伤（回帖拟合公式）

```
减伤率 = 最终防御 / (最终防御 + 890)
受到伤害 = 怪物攻击 × 攻击倍率 × 890 / (最终防御 + 890)
```

## UI 设计

### 页面结构

标签页切换四种模式：

- **基础模式**: 最终ATK/DEF/HP + 技能系数 → 直接算伤害
- **进阶模式**: 基础属性 + 局外加成 + 局内加成 + 技能系数 → 完整计算链
- **最优分析**: 固定参数，扫描暴击率×暴伤二维网格 → Plotly 3D曲面图
- **蒙特卡洛**: 给定暴击率，模拟N次攻击 → 损害分布直方图 + 统计摘要

### 结果面板

- 非暴击伤害 / 暴击伤害 / 期望伤害
- 可展开的计算过程（逐步显示中间值）
- 配置对比：两个结果面板并排，支持保存/加载到 localStorage

### 最优分析

- X轴: 暴击率 0~100（步长1，101点）
- Y轴: 暴伤倍率 100~300（步长2，101点）
- Z轴: 期望伤害
- 总计算量: 101×101 = 10201次，< 100ms
- Plotly surface 图 + 热力图可切换

### 蒙特卡洛

- 可选次数: 1000 / 10000 / 100000 / 1000000
- 可选随机种子（可复现）
- 大批量用 requestAnimationFrame 分批，避免阻塞 UI
- 输出: 均值/中位数/P25/P75/最大暴击/最小非暴击 + 直方图

### 视觉风格

- 深色背景（#1a1a2e ~ #16213e 渐变）
- 强调色: 金/琥珀 #f0a500（按钮、高亮）
- 卡片面板带微弱发光边框
- 输入框半透明暗色背景

## 错误处理

| 场景 | 处理 |
|------|------|
| 空值/非法输入 | 输入框变红 + 提示，不触发计算 |
| eff_value = 0 | 提示"技能系数不能为0" |
| 暴击率 = 0 | 暴击伤害列显示 "—" |
| 暴击率 = 100 | 非暴击列显示 "—" |
| DVA 列表为空 | 跳过 DVA 步骤 |
| PS 倍率 = 0 | 结果为 0，正常显示 |

## 测试策略

`DamageEngine.runTests()` 内置 12 个测试用例，浏览器控制台可调用：

1. 属性计算: base/out/in → S_ATK/S_DEF/S_HP
2. 护盾防御: baseDef/totalDef → S_DEF_SHIELD
3. 基础伤害: eff_value/stat → floor 结果
4. 暴击伤害: 固定种子 → 暴击倍率
5. 属性颜色克制: 五种颜色 → 颜色系数
6. DVA 操作: 每种 MATHSIGN 各一个用例
7. FINAL 独立乘区: 验证与常规乘法不合并
8. 端到端: 完整流程输入 → 最终伤害
9. stat BASE_ON_DEF: S_DEF×2.1 + S_ATK×0.3
10. stat DEF_80_PCT: S_DEF×0.8 + S_ATK×0.2
11. 贯穿伤害: 跳过护盾
12. 护盾公式: eff_value × DEF_SHIELD / 100 × 0.3

## 回帖补充信息

- 治愈暗改: 之前治愈吃的防御力和护盾一样有0.5修正，现在不挨了
- 伙伴防御并入基础防御力，可吃百分比加成，但治愈仍只作用一半
- 吉他弹力效果翻倍加强
- dmg_revise_rate 从 0.35 暗改为 0.36
