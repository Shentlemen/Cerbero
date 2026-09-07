import { ChartConfiguration, ChartData, ChartEvent, Plugin, TooltipItem } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

export interface ChartDatum {
  label: string;
  y: number;
  originalLabel?: string;
}

export interface ChartLegendItem {
  label: string;
  value: number;
  color: string;
}

export const TERMINAL_COLORS = [
  '#2E86AB',
  '#A23B72',
  '#F18F01',
  '#C73E1D',
  '#8E44AD',
  '#95A5A6',
  '#E67E22'
];

export const NETWORK_COLORS = [
  '#3498db',
  '#e74c3c',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#34495e',
  '#e67e22'
];

/** Misma paleta categórica que Terminales / Red, para barras de fabricante y SO. */
const CATEGORY_COLORS = [...TERMINAL_COLORS];
for (const color of NETWORK_COLORS) {
  const already = CATEGORY_COLORS.some((c) => c.toLowerCase() === color.toLowerCase());
  if (!already) CATEGORY_COLORS.push(color);
}

function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

/** Sombra suave en las series para dar profundidad. */
export const datasetShadowPlugin: Plugin = {
  id: 'cerberoDatasetShadow',
  beforeDatasetDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
  },
  afterDatasetDraw(chart) {
    chart.ctx.restore();
  }
};

export const dashboardChartPlugins: Plugin[] = [ChartDataLabels, datasetShadowPlugin];

const animation = {
  duration: 900,
  easing: 'easeOutQuart' as const
};

function fontSize(compact: boolean, card: number, modal: number): number {
  return compact ? card : modal;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function isDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark');
}

function parseHexColor(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '').trim();
  if (raw.length === 3) {
    return [
      parseInt(raw[0] + raw[0], 16),
      parseInt(raw[1] + raw[1], 16),
      parseInt(raw[2] + raw[2], 16)
    ];
  }
  if (raw.length !== 6 || Number.isNaN(parseInt(raw, 16))) {
    return null;
  }
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16)
  ];
}

/** Texto oscuro o blanco según la luminancia del fondo (barras / porciones). */
function contrastInkForBackground(hex: string): '#0f172a' | '#ffffff' {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return '#ffffff';
  }
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.38 ? '#0f172a' : '#ffffff';
}

function doughnutLabelBackground(sliceColor: string): string {
  return contrastInkForBackground(sliceColor) === '#ffffff'
    ? 'rgba(15, 23, 42, 0.78)'
    : 'rgba(255, 255, 255, 0.9)';
}

/** Tinta de ejes y etiquetas: en pantalla sigue el tema; en PDF siempre oscuro sobre blanco. */
function chartInk(printSafe = false) {
  if (printSafe) {
    return {
      tick: '#334155',
      muted: '#475569',
      label: '#0f172a',
      grid: 'rgba(100, 116, 139, 0.32)',
      datalabel: '#0f172a',
      datalabelBg: '#ffffff'
    };
  }
  const dark = isDarkTheme();
  return {
    tick: readCssVar('--ds-color-subtle', dark ? '#d5dae2' : '#334155'),
    muted: readCssVar('--ds-color-subtle', dark ? '#d5dae2' : '#475569'),
    label: readCssVar('--ds-color-text', dark ? '#f3f4f7' : '#0f172a'),
    grid: dark ? 'rgba(210, 216, 226, 0.16)' : 'rgba(148, 163, 184, 0.25)',
    datalabel: readCssVar('--ds-color-heading', dark ? '#ffffff' : '#0f172a'),
    datalabelBg: dark ? 'rgba(37, 40, 48, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  };
}

/** Fondo blanco del canvas al exportar (el Chart.js queda transparente y el PDF lo pinta blanco). */
export const printCanvasBackgroundPlugin: Plugin = {
  id: 'cerberoPrintCanvasBackground',
  beforeDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

function doughnutDisplayValues(items: ChartDatum[], minValue: number): number[] {
  return items.map((item) => (item.y < minValue ? minValue : item.y));
}

function tooltipRealValue(items: ChartDatum[]) {
  return (ctx: TooltipItem<'doughnut' | 'bar' | 'pie'>) => {
    const item = items[ctx.dataIndex];
    const name = item?.originalLabel || item?.label || String(ctx.label || '');
    const value = item?.y ?? 0;
    return ` ${name}: ${value}`;
  };
}

function doughnutSliceShares(displayValues: number[]): number[] {
  const total = displayValues.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return displayValues.map(() => 0);
  return displayValues.map((value) => value / total);
}

export function buildDoughnutChart(
  items: ChartDatum[],
  colors: string[],
  compact: boolean,
  emptyLabel?: string,
  printSafe = false
): { data: ChartData<'doughnut'>; options: ChartConfiguration<'doughnut'>['options'] } {
  const isEmpty = items.length === 0;
  const source = isEmpty
    ? [{ label: emptyLabel || 'Sin datos', y: 1, originalLabel: emptyLabel || 'Sin datos' }]
    : items;
  const display = isEmpty ? [1] : doughnutDisplayValues(source, 25);
  const palette = isEmpty ? ['#cbd5e1'] : source.map((_, i) => colors[i % colors.length]);

  const data: ChartData<'doughnut'> = {
    labels: source.map((d) => d.label),
    datasets: [
      {
        data: display,
        backgroundColor: palette,
        borderColor: printSafe ? '#e2e8f0' : '#ffffff',
        borderWidth: compact ? 3 : 4,
        hoverOffset: isEmpty ? 0 : compact ? 8 : 12,
        hoverBorderWidth: 4,
        spacing: source.length > 1 ? 2 : 0,
        borderRadius: source.length > 1 ? 6 : 0
      }
    ]
  };

  const shares = doughnutSliceShares(display);
  const minShare = compact ? 0.07 : 0.05;

  const options: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 80,
    animation,
    cutout: '42%',
    rotation: -90,
    layout: {
      padding: compact ? 8 : 16
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: !isEmpty,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleFont: { size: fontSize(compact, 12, 15), weight: 600 },
        bodyFont: { size: fontSize(compact, 12, 15) },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: () => '',
          label: tooltipRealValue(source)
        }
      },
      datalabels: {
        display: (ctx) => {
          if (isEmpty) return true;
          return (shares[ctx.dataIndex] ?? 0) >= minShare;
        },
        color: (ctx) => {
          if (isEmpty) return printSafe ? '#334155' : '#475569';
          return contrastInkForBackground(String(palette[ctx.dataIndex] || '#334155'));
        },
        backgroundColor: (ctx) => {
          if (isEmpty) return 'transparent';
          return doughnutLabelBackground(String(palette[ctx.dataIndex] || '#334155'));
        },
        borderRadius: 4,
        padding: isEmpty ? 0 : { top: 3, bottom: 3, left: 6, right: 6 },
        font: {
          size: fontSize(compact, 10, 13),
          weight: 700
        },
        textAlign: 'center',
        anchor: 'center',
        align: 'center',
        offset: 0,
        clamp: true,
        clip: true,
        formatter: (_value, ctx) => {
          const item = source[ctx.dataIndex];
          if (!item) return '';
          if (isEmpty) return item.label;
          return `${item.label}\n${item.y}`;
        }
      }
    }
  };

  return { data, options };
}

export function doughnutLegendItems(
  items: ChartDatum[],
  colors: string[]
): ChartLegendItem[] {
  return items.map((item, index) => ({
    label: item.originalLabel || item.label,
    value: item.y,
    color: colors[index % colors.length]
  }));
}

export function buildColumnChart(
  items: ChartDatum[],
  compact: boolean,
  printSafe = false
): { data: ChartData<'bar'>; options: ChartConfiguration<'bar'>['options'] } {
  const ink = chartInk(printSafe);
  const data: ChartData<'bar'> = {
    labels: items.map((d) => d.label),
    datasets: [
      {
        data: items.map((d) => d.y),
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: compact ? 36 : 56,
        minBarLength: 10,
        backgroundColor: items.map((_, i) => categoryColor(i)),
        hoverBackgroundColor: items.map((_, i) => categoryColor(i))
      }
    ]
  };

  const options: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 80,
    animation,
    layout: { padding: { top: printSafe ? 28 : 18, right: 8, left: 4, bottom: 4 } },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: fontSize(compact, 10, 13), weight: 600 },
          color: ink.label,
          maxRotation: compact ? 45 : 40,
          minRotation: compact ? 0 : 0,
          autoSkip: compact,
          maxTicksLimit: compact ? 10 : 40
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cantidad',
          color: ink.muted,
          font: { size: fontSize(compact, 11, 14), weight: 600 }
        },
        ticks: {
          font: { size: fontSize(compact, 11, 13) },
          color: ink.tick,
          precision: 0
        },
        grid: {
          color: ink.grid
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: () => '',
          label: tooltipRealValue(items)
        }
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: -2,
        color: ink.datalabel,
        backgroundColor: ink.datalabelBg,
        borderColor: printSafe ? '#cbd5e1' : 'transparent',
        borderWidth: printSafe ? 1 : 0,
        borderRadius: 4,
        padding: { top: 2, bottom: 2, left: 5, right: 5 },
        font: { size: fontSize(compact, 10, 13), weight: 700 },
        formatter: (_value, ctx) => String(items[ctx.dataIndex]?.y ?? '')
      }
    }
  };

  return { data, options };
}

export function buildHorizontalBarChart(
  items: ChartDatum[],
  compact: boolean,
  useFullLabels: boolean,
  printSafe = false
): { data: ChartData<'bar'>; options: ChartConfiguration<'bar'>['options'] } {
  const ink = chartInk(printSafe);
  const labels = items.map((d) =>
    useFullLabels ? d.originalLabel || d.label : d.label
  );

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        data: items.map((d) => d.y),
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: compact ? 22 : 32,
        minBarLength: 10,
        backgroundColor: items.map((_, i) => categoryColor(i)),
        hoverBackgroundColor: items.map((_, i) => categoryColor(i))
      }
    ]
  };

  const options: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 80,
    animation,
    layout: { padding: { top: 8, right: printSafe ? 40 : 28, left: 4, bottom: 4 } },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cantidad',
          color: ink.muted,
          font: { size: fontSize(compact, 11, 14), weight: 600 }
        },
        ticks: {
          font: { size: fontSize(compact, 11, 13) },
          color: ink.tick,
          precision: 0
        },
        grid: { color: ink.grid }
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: fontSize(compact, 10, 13), weight: 600 },
          color: ink.label,
          autoSkip: false
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          title: () => '',
          label: tooltipRealValue(items)
        }
      },
      datalabels: {
        anchor: 'end',
        align: 'right',
        color: ink.datalabel,
        backgroundColor: ink.datalabelBg,
        borderColor: printSafe ? '#cbd5e1' : 'transparent',
        borderWidth: printSafe ? 1 : 0,
        borderRadius: 4,
        padding: { top: 1, bottom: 1, left: 5, right: 5 },
        font: { size: fontSize(compact, 10, 13), weight: 700 },
        formatter: (_value, ctx) => String(items[ctx.dataIndex]?.y ?? '')
      }
    }
  };

  return { data, options };
}

export function chartClickIndex(event: { active?: object[] } | { event?: ChartEvent; active?: object[] }): number | null {
  const active = event?.active as Array<{ index?: number }> | undefined;
  if (!active?.length) return null;
  const index = active[0]?.index;
  return typeof index === 'number' ? index : null;
}
