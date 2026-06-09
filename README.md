<div align="center">

# 🗡️ 卡厄思梦境 · 伤害计算器

**基于代码层伤害公式的浏览器端伤害计算与优化工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[功能特性](#功能特性) · [快速开始](#快速开始) · [伤害公式](#伤害公式) · [项目结构](#项目结构) · [数据来源](#数据来源)

[English README](README_EN.md)

</div>

---

## 简介

《卡厄思梦境》（Chaos Zero Nightmare）是一款赛季制肉鸽卡牌 RPG。游戏的伤害系统涉及多层乘区、属性克制、DVA 被动修饰等复杂机制，仅靠游戏内文字描述很难搞清楚实际计算逻辑。

NGA 玩家社区发布了从代码层面逆向分析伤害机制的超硬核帖子（[P1](https://bbs.nga.cn/read.php?tid=46932958)），完整拆解了属性计算、伤害公式、DVA 修饰、护盾/治愈等全部底层逻辑。本项目将这些公式转化为可交互的计算工具，方便玩家：

- 快速验证伤害数值
- 优化暴击率/暴伤分配
- 模拟记忆碎片强化结果
- 对比不同装备方案的伤害差异

## 起因

NGA 玩家社区发布了一篇从代码层面分析《卡厄思梦境》伤害机制的超硬核帖子（[tid=46932958](https://bbs.nga.cn/read.php?tid=46932958)），详细拆解了属性计算、伤害公式、DVA修饰、护盾/治愈等全部底层逻辑。本项目将这些公式转化为可交互的计算工具，方便玩家快速验证和优化自己的配置。

## 功能特性

### 📊 基础模式

输入最终 ATK、暴击率、暴伤等参数，一键计算非暴击/暴击/期望伤害，并展示完整的计算过程。

- 支持 6 种伤害类型（普通/贯穿/固定/基于防御混合/80%防御/100%防御）
- 支持 DVA 被动修饰列表（10 种运算符）
- 计算过程逐步展示，可对照游戏验证

### 🔧 进阶模式

从角色基础属性开始，走完整计算链：

```
基础属性 → 局外加成（装备/记忆碎片/伙伴）→ 局内加成（战斗buff）→ 最终伤害
```

- 自动计算 S_ATK / S_DEF / S_HP / S_DEF_SHIELD
- 支持基于防御的混合伤害（S_DEF × 2.1 + S_ATK × 0.3）

### 📈 最优分析（三个子功能）

| 子功能 | 说明 |
|--------|------|
| **暴击曲面图** | 暴击率 × 暴伤的 3D 期望伤害曲面（Plotly.js），可视化最优点 |
| **有限资源分配** | 给定可分配属性点，计算暴击率 vs 暴伤的最优分配比例 |
| **装备词条优化** | 模拟记忆碎片系统：主词条二选一 + 副词条强化分配 + 蒙特卡洛随机模拟 |

### 🎲 蒙特卡洛模拟

随机模拟 N 次攻击（1,000 ~ 1,000,000 次），输出：

- 平均伤害 / 中位数 / P25 / P75
- 实际暴击率
- 伤害分布直方图
- 支持随机种子复现

### 💾 配置对比

保存/加载两套配置到 localStorage，对比不同方案的伤害差异。

## 伤害公式

### 属性计算

```
最终属性 = round(
  round((基础值 × (1 + 局外百分比%) + 局外固定) × (1 + 局内计算%))
  × (1 + 局内百分比%) + 局内固定
)
```

护盾防御力（特殊）：
```
S_DEF_SHIELD = 基础DEF × 1.0 + 额外DEF × 0.5
```

### 伤害计算流程

```
① eff_value（技能系数，含弱点/脆弱/虚弱）
② calcValue()（HP百分比、cost乘法、buff数量等转换）
③ PS 倍率（怪物 PowerStep 模式）
④ DVA 被动修饰（plus / multi / set / final 独立乘区）
⑤ 暴击判定（S_CRI vs 随机数 → × 暴伤倍率）
⑥ 属性乘法（value × stat / 100）
⑦ 修正乘法（floor(value × 0.36)）
⑧ 属性颜色克制（value × (1 + 属性伤害% / 100)）
⑨ 追加攻击修正（value × (1 + 追加攻击% / 100)）
⑩ 盾血分配 / 免伤 / 减伤 / 分担
```

### stat 取值

| 伤害类型 | stat 值 |
|----------|--------|
| 默认（普通/追加/DOT/吸血） | S_ATK |
| DMG_ATTR_BASE_ON_DEF | S_DEF × 2.1 + S_ATK × 0.3 |
| DMG_ATTR_DEF_80_PCT | S_DEF × 0.8 + S_ATK × 0.2 |
| DMG_ATTR_DEF_100_PCT | S_DEF |
| DMG_ATTR_IGNORE_STAT | 0（固定伤害） |

### 全局常量

| 常量 | 值 | 说明 |
|------|------|------|
| dmg_revise_rate | 0.36 | 全局伤害修正系数（曾为 0.35，后暗改） |
| shield_revise_rate | 0.3 | 全局护盾修正系数 |
| 防御减伤公式 | 减伤率 = DEF/(DEF+890) | 回帖拟合公式 |

## 快速开始

### 环境要求

- 任意现代浏览器（Chrome / Firefox / Safari / Edge）
- Python 3（用于启动本地 HTTP 服务器，ES Module 需要）

### 安装运行

```bash
# 1. 克隆仓库
git clone https://github.com/AsukaNemu/czn_damage.git
cd czn_damage

# 2. 启动本地服务器
python3 -m http.server 8080

# 3. 打开浏览器
open http://localhost:8080
```

> **无需安装任何依赖，无 npm / 无构建工具，纯静态页面。**

### 验证引擎

打开浏览器控制台（F12），运行：

```javascript
DamageEngine.runTests()
// 输出: "✓ 12/12 tests passed"
```

## 项目结构

```
czn_damage/
├── index.html              # 主页面
├── css/style.css           # 游戏原生暗色风格
├── js/
│   ├── damage-engine.js    # 伤害计算引擎（纯函数，13个内置测试）
│   ├── optimizer.js        # 最优暴击区间 + 装备词条优化 + 蒙特卡洛模拟
│   ├── monte-carlo.js      # 暴击蒙特卡洛模拟
│   ├── charts.js           # Plotly 图表封装
│   └── app.js              # UI 控制器
├── data/constants.json     # 游戏全局常量
├── docs/
│   ├── superpowers/specs/  # 设计文档
│   └── superpowers/plans/  # 实现计划
└── README.md
```

## 游戏默认值

| 属性 | 默认值 |
|------|--------|
| 角色基础暴击率 | 3% |
| 角色基础暴伤 | 125% |
| 记忆碎片暴击率主词条 | +27% |
| 记忆碎片暴伤主词条 | +40.8% |
| 副词条暴击率范围 | 1.2% ~ 2.0%（均值 1.6%） |
| 副词条暴伤范围 | 2.4% ~ 4.0%（均值 3.2%） |
| 五星一级攻击力 | ~160 |
| 队伍防御力 | 3人平均值 |

## 技术栈

| 技术 | 用途 |
|------|------|
| HTML5 / CSS3 | 页面结构与样式 |
| JavaScript (ES Modules) | 计算引擎与 UI 逻辑 |
| Plotly.js (CDN) | 3D 曲面图 / 热力图 / 直方图 |

- 无构建工具
- 无 npm 依赖
- 纯静态页面，浏览器直接运行

## 数据来源

| 来源 | 链接 |
|------|------|
| NGA 代码层伤害分析 | [P1](https://bbs.nga.cn/read.php?tid=46932958) |
| GameKee Wiki | [伤害计算&记忆碎片词条选择](https://wiki.biligame.com/czsjm/) |
| Prydwen | [Damage Formula](https://www.prydwen.gg/chaos-zero-nightmare/guides/damage-formula/) |

## 致谢

- NGA 楼主 Daiyousei（UID:64707090）提供的代码层面伤害分析
- 回帖中补充防御减伤公式、队伍防御取平均值等关键信息的玩家们
- GameKee Wiki 上的攻略作者们

## License

MIT
