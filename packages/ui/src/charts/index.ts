// Charts come only from here (UI standard §4). recharts-based charts are lazy (./lazy); the rest are plain DOM/SVG and
// stay static — HBarChart's height follows its rows, so a fixed-height loader would shift.
export { CHART_HEIGHT, legendItems, OTHER_COLOR, seriesColor } from "./chart-theme";
export { ChartFrame, ChartLegend, type LegendItem } from "./chart-frame";
export { BarChart, TimeSeriesChart } from "./lazy";
export { HBarChart } from "./hbar-chart";
export { Sparkline, SparkWell } from "./sparkline";
export { Heatmap, HeatGrid } from "./heatmap";
export { DistributionBar, ModelShare } from "./distribution-bar";
