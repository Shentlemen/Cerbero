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

/** Tinta de ejes y etiquetas desde tokens --ds-* (claro y oscuro). */
function chartInk() {
  const dark = isDarkTheme();
  return {
    tick: readCssVar('--ds-color-subtle', dark ? '#d5dae2' : '#475569'),
    muted: readCssVar('--ds-color-faint', dark ? '#c2c8d2' : '#64748b'),
    label: readCssVar('--ds-color-text', dark ? '#f3f4f7' : '#334155'),
    grid: dark ? 'rgba(210, 216, 226, 0.16)' : 'rgba(148, 163, 184, 0.25)',
    datalabel: readCssVar('--ds-color-heading', dark ? '#ffffff' : '#0f172a'),
    datalabelBg: dark ? 'rgba(37, 40, 48, 0.92)' : 'rgba(255, 255, 255, 0.88)'
  };
}

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
  emptyLabel?: string
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
        borderColor: '#ffffff',
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
        color: isEmpty ? '#475569' : '#ffffff',
        backgroundColor: isEmpty ? 'transparent' : 'rgba(15, 23, 42, 0.5)',
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
  compact: boolean
): { data: ChartData<'bar'>; options: ChartConfiguration<'bar'>['options'] } {
  const ink = chartInk();
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
    layout: { padding: { top: 18, right: 8, left: 4, bottom: 4 } },
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
  useFullLabels: boolean
): { data: ChartData<'bar'>; options: ChartConfiguration<'bar'>['options'] } {
  const ink = chartInk();
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
    layout: { padding: { top: 8, right: 28, left: 4, bottom: 4 } },
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
