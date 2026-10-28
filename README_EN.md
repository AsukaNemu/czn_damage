<div align="center">

# 🗡️ Chaos Zero Nightmare · Damage Calculator

**A browser-based damage calculation and optimization tool built from code-level damage formulas**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#features) · [Quick Start](#quick-start) · [Damage Formula](#damage-formula) · [Project Structure](#project-structure) · [Data Sources](#data-sources)

[中文版 README](README.md)

</div>

---

## About

*Chaos Zero Nightmare* is a seasonal roguelike card RPG. Its damage system involves multi-layer damage multipliers, elemental advantage, DVA (Damage Value Add) passive modifiers, and other complex mechanics that are difficult to understand from in-game text descriptions alone.

A player on NGA forums published a thorough code-level reverse-engineering of the damage system ([P1](https://bbs.nga.cn/read.php?tid=46932958)), covering attribute calculations, damage formulas, DVA modifiers, shields, and healing. This project converts those formulas into an interactive calculator so players can:

- Verify damage numbers quickly
- Optimize crit rate / crit damage allocation
- Simulate memory fragment (artifact) enhancement results
- Compare damage across different equipment builds

## Features

### 📊 Basic Mode

Enter final ATK, crit rate, crit damage and other parameters to instantly calculate non-crit / crit / expected damage with a full step-by-step breakdown.

- 6 damage types (Normal / Penetrate / Fixed / DEF-based / 80% DEF / 100% DEF)
- DVA modifier list (10 operator types)
- Step-by-step calculation trace for verification

### 🔧 Advanced Mode

Full calculation chain starting from base character stats:

```
Base Stats → Out-of-Battle Bonuses (Equipment / Memory Fragments / Partners) → In-Battle Bonuses (Buffs) → Final Damage
```

- Auto-calculates S_ATK / S_DEF / S_HP / S_DEF_SHIELD
- Supports DEF-based hybrid damage (S_DEF × 2.1 + S_ATK × 0.3)

### 📈 Optimization Analysis (3 sub-features)

| Sub-feature | Description |
|-------------|-------------|
| **Crit Surface Chart** | 3D expected damage surface (Plotly.js) across crit rate × crit damage, with optimal point highlighted |
| **Limited Resource Allocation** | Given a fixed budget of stat points, find the optimal split between crit rate and crit damage |
| **Equipment Substat Optimization** | Simulates the memory fragment system: main stat choice + substat enhancement allocation + Monte Carlo random simulation |

### 🎲 Monte Carlo Simulation

Simulates N random attacks (1,000 ~ 1,000,000 iterations), outputting:

- Mean / median / P25 / P75 damage
- Actual crit rate observed
- Damage distribution histogram
- Reproducible with random seed

### 💾 Config Comparison

Save/load two configurations to localStorage and compare damage differences side by side.

## Quick Start

### Requirements

- Any modern browser (Chrome / Firefox / Safari / Edge)
- Python 3 (for local HTTP server, required by ES Modules)

### Install & Run

```bash
# 1. Clone the repository
git clone https://github.com/AsukaNemu/czn_damage.git
cd czn_damage

# 2. Start local server
python3 -m http.server 8080

# 3. Open in browser
open http://localhost:8080
```

> **No dependencies to install. No npm. No build tools. Pure static files.**

### Verify Engine

Open browser console (F12), run:

```javascript
DamageEngine.runTests()
// Returns { passed: 13, total: 13, failures: [] }
```

Run the same existing engine assertions from the command line with Node.js 22 (used by CI; Node.js is optional for browser use):

```bash
node --experimental-default-type=module test/run-tests.mjs
```

Any failed assertion exits with a nonzero status. These assertions check the formulas recorded in this repository, not the current game's seasonal data.

## Damage Formula

### Attribute Calculation

```
Final Stat = round(
  round((Base × (1 + Out-of-Battle %) + Out-of-Battle Flat) × (1 + In-Battle Calc %))
  × (1 + In-Battle %) + In-Battle Flat
)
```

Shield Defense (special):
```
S_DEF_SHIELD = Base DEF × 1.0 + Extra DEF × 0.5
```

### Damage Calculation Pipeline

```
① eff_value (skill coefficient, includes Weakness / Vulnerability / Weakened)
② calcValue() (HP%, cost multiplier, buff/debuff count conversions)
③ PS ratio (monster PowerStep mode)
④ DVA passive modifiers (plus / multi / set / final — independent multiplier buckets)
⑤ Crit check (S_CRI vs random → × crit damage multiplier)
⑥ Stat multiplication (value × stat / 100)
⑦ Revision multiplication (floor(value × 0.36))
⑧ Elemental bonus (value × (1 + elemental_dmg% / 100))
⑨ Additional attack bonus (value × (1 + additional_atk% / 100))
⑩ Shield/HP distribution / damage immunity / reduction / sharing
```

### stat Values by Damage Type

| Damage Type | stat Value |
|-------------|------------|
| Default (Normal / Additional / DOT / Leech) | S_ATK |
| DMG_ATTR_BASE_ON_DEF | S_DEF × 2.1 + S_ATK × 0.3 |
| DMG_ATTR_DEF_80_PCT | S_DEF × 0.8 + S_ATK × 0.2 |
| DMG_ATTR_DEF_100_PCT | S_DEF |
| DMG_ATTR_IGNORE_STAT | 0 (fixed damage) |

### Global Constants

| Constant | Value | Description |
|----------|-------|-------------|
| dmg_revise_rate | 0.36 | Global damage revision coefficient (was 0.35, stealth-changed) |
| shield_revise_rate | 0.3 | Global shield revision coefficient |
| DEF reduction formula | Reduction = DEF / (DEF + 890) | Empirically fitted by players |

## Game Defaults

| Attribute | Default Value |
|-----------|---------------|
| Base Crit Rate | 3% |
| Base Crit Damage | 125% |
| Memory Fragment Crit Rate Main Stat | +27% |
| Memory Fragment Crit DMG Main Stat | +40.8% |
| Substat Crit Rate Range | 1.2% ~ 2.0% (avg 1.6%) |
| Substat Crit DMG Range | 2.4% ~ 4.0% (avg 3.2%) |
| 5★ Level 1 ATK | ~160 |
| Party Defense | Average of 3 members |

## Project Structure

```
czn_damage/
├── index.html                 # Main page
├── css/
│   └── style.css              # Game-native dark theme
├── js/
│   ├── damage-engine.js       # Damage calculation engine (pure functions, 12 built-in tests)
│   ├── optimizer.js           # Crit optimization + equipment substat optimization + Monte Carlo
│   ├── monte-carlo.js         # Monte Carlo crit simulation
│   ├── charts.js              # Plotly chart wrappers
│   └── app.js                 # UI controller (event binding / form reading / result rendering)
├── data/
│   └── constants.json         # Game global constants
├── docs/
│   └── superpowers/
│       ├── specs/             # Design documents
│       └── plans/             # Implementation plans
├── README.md                  # Chinese README
└── README_EN.md               # This file
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 / CSS3 | Page structure and styling |
| JavaScript (ES Modules) | Calculation engine and UI logic |
| Plotly.js (CDN) | 3D surface charts / heatmaps / histograms |

- No build tools
- No npm dependencies
- Pure static files, runs directly in browser

## Data Sources

| Source | Link |
|--------|------|
| NGA Code-Level Damage Analysis | [P1](https://bbs.nga.cn/read.php?tid=46932958) |
| GameKee Wiki | [Damage Calc & Memory Fragment Guide](https://wiki.biligame.com/czsjm/) |
| Prydwen | [Damage Formula](https://www.prydwen.gg/chaos-zero-nightmare/guides/damage-formula/) |

## Acknowledgments

- NGA poster Daiyousei (UID: 64707090) for the code-level damage analysis
- Players in the thread who contributed the DEF reduction formula, party DEF averaging, and other key findings
- GameKee Wiki authors

## License

MIT
