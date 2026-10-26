export interface DashboardChartCount {
  label: string;
  y: number;
}

export interface DashboardStatsDTO {
  terminales: DashboardChartCount[];
  fabricantes: DashboardChartCount[];
  sistemasOperativos: DashboardChartCount[];
  dispositivosRed: DashboardChartCount[];
}
