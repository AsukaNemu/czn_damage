/**
 * 卡厄思梦境 — Plotly 图表渲染模块
 * 纯渲染封装，依赖全局 Plotly（通过 <script> 引入）。
 */

// ─── Plotly 暗色主题常量 ─────────────────────────────────────────────────────

const DARK_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#f0a500' },
  margin: { l: 60, r: 30, t: 50, b: 60 },
};

const GOLD_COLORSCALE = [
  [0, '#0d1b2a'],
  [0.2, '#1b2838'],
  [0.4, '#2a4858'],
  [0.6, '#3a6858'],
  [0.8, '#8a8a20'],
  [1, '#f0a500'],
];

// ─── renderSurface ───────────────────────────────────────────────────────────

/**
 * Plotly 3D 曲面图：暴击率 × 暴伤倍率 → 期望伤害。
 *
 * @param {string} containerId - DOM 容器 ID
 * @param {{ x: number[], y: number[], z: number[][], maxPoint: object }} surfaceData
 */
export function renderSurface(containerId, surfaceData) {
  const { x, y, z, maxPoint } = surfaceData;

  const surface = {
    type: 'surface',
    x,
    y,
    z,
    colorscale: GOLD_COLORSCALE,
    contours: {
      z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } },
    },
    colorbar: {
      title: '期望伤害',
      titlefont: { color: '#f0a500' },
      tickfont: { color: '#ccc' },
    },
    hovertemplate:
      '暴击率: %{x:.0f}%<br>暴伤倍率: %{y:.0f}%<br>期望伤害: %{z:.0f}<extra></extra>',
  };

  const maxMarker = {
    type: 'scatter3d',
    mode: 'markers',
    x: [maxPoint.critRate],
    y: [maxPoint.critDmgRate],
    z: [maxPoint.expectedDamage],
    marker: { size: 8, color: '#ff4444', symbol: 'circle' },
    name: `最优 (${maxPoint.critRate}%, ${maxPoint.critDmgRate}%)`,
    hovertemplate:
      `最优解<br>暴击率: ${maxPoint.critRate}%<br>暴伤倍率: ${maxPoint.critDmgRate}%<br>期望伤害: ${maxPoint.expectedDamage}<extra></extra>`,
  };

  const layout = {
    ...DARK_LAYOUT,
    scene: {
      xaxis: { title: '暴击率 (%)', gridcolor: '#2a3a4a', zerolinecolor: '#2a3a4a' },
      yaxis: { title: '暴伤倍率 (%)', gridcolor: '#2a3a4a', zerolinecolor: '#2a3a4a' },
      zaxis: { title: '期望伤害', gridcolor: '#2a3a4a', zerolinecolor: '#2a3a4a' },
    },
  };

  Plotly.newPlot(containerId, [surface, maxMarker], layout, { responsive: true });
}

// ─── renderHeatmap ───────────────────────────────────────────────────────────

/**
 * Plotly 2D 热力图版本。
 *
 * @param {string} containerId
 * @param {{ x: number[], y: number[], z: number[][], maxPoint: object }} surfaceData
 */
export function renderHeatmap(containerId, surfaceData) {
  const { x, y, z, maxPoint } = surfaceData;

  const heatmap = {
    type: 'heatmap',
    x,
    y,
    z,
    colorscale: GOLD_COLORSCALE,
    colorbar: {
      title: '期望伤害',
      titlefont: { color: '#f0a500' },
      tickfont: { color: '#ccc' },
    },
    hovertemplate:
      '暴击率: %{x:.0f}%<br>暴伤倍率: %{y:.0f}%<br>期望伤害: %{z:.0f}<extra></extra>',
  };

  const layout = {
    ...DARK_LAYOUT,
    xaxis: { title: '暴击率 (%)', gridcolor: '#2a3a4a' },
    yaxis: { title: '暴伤倍率 (%)', gridcolor: '#2a3a4a' },
    annotations: [
      {
        x: maxPoint.critRate,
        y: maxPoint.critDmgRate,
        text: `最优: ${maxPoint.expectedDamage}`,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#ff4444',
        font: { color: '#ff4444', size: 13 },
        bgcolor: 'rgba(0,0,0,0.7)',
        bordercolor: '#ff4444',
      },
    ],
  };

  Plotly.newPlot(containerId, [heatmap], layout, { responsive: true });
}

// ─── renderHistogram ─────────────────────────────────────────────────────────

/**
 * Plotly 直方图：蒙特卡洛模拟结果分布。
 *
 * @param {string} containerId
 * @param {number[]} distribution - 排序后的伤害值数组
 * @param {{ mean: number, median: number }} stats
 */
export function renderHistogram(containerId, distribution, stats) {
  const histogram = {
    type: 'histogram',
    x: distribution,
    marker: {
      color: 'rgba(240, 165, 0, 0.6)',
      line: { color: 'rgba(30, 42, 58, 0.9)', width: 1 },
    },
    hovertemplate: '伤害: %{x:.0f}<br>频次: %{y}<extra></extra>',
  };

  const layout = {
    ...DARK_LAYOUT,
    xaxis: { title: '伤害值', gridcolor: '#2a3a4a' },
    yaxis: { title: '频次', gridcolor: '#2a3a4a' },
    shapes: [
      {
        type: 'line',
        x0: stats.mean,
        x1: stats.mean,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: '#f0a500', width: 2, dash: 'solid' },
      },
      {
        type: 'line',
        x0: stats.median,
        x1: stats.median,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: '#ffffff', width: 2, dash: 'dash' },
      },
    ],
    annotations: [
      {
        x: stats.mean,
        y: 1,
        yref: 'paper',
        text: `均值: ${stats.mean.toFixed(1)}`,
        showarrow: false,
        font: { color: '#f0a500', size: 12 },
        yanchor: 'bottom',
      },
      {
        x: stats.median,
        y: 0.95,
        yref: 'paper',
        text: `中位数: ${stats.median.toFixed(1)}`,
        showarrow: false,
        font: { color: '#ffffff', size: 12 },
        yanchor: 'bottom',
      },
    ],
  };

  Plotly.newPlot(containerId, [histogram], layout, { responsive: true });
}
