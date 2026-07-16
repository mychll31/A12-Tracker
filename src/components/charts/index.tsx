"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

/**
 * Every chart in Abundance Hub.
 *
 * Recharts cannot read CSS custom properties, so the palette is duplicated here
 * as literals. These hues are the same ones `scoreTone()` assigns in
 * src/lib/utils.ts — a 72 is the same colour in a ring, a badge and a line.
 */
const COLORS = {
  primary: "#eab73f", // gold — the overall score, the headline series
  emerald: "#5ee6a8", // the same green the landing scores a 100 with
  amber: "#eab73f", // warning threshold on the bar charts
  sky: "#58c8ff",
  rose: "#f0607a",
  // Consistency needs a hue of its own: it cannot share gold with Overall, or the
  // two lines on the score-trend chart become one indistinguishable line. This
  // violet is already in the palette — it is in the landing's avatar gradients.
  violet: "#8b6cff",
  grid: "rgba(159,168,201,0.14)",
  axis: "#9fa8c9",
} as const;

const AXIS = {
  stroke: COLORS.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Charts are dense; a full ISO date on every tick is unreadable. */
function shortDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-raised)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--foreground)",
    boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
  },
  labelStyle: { color: "var(--muted)", marginBottom: 4 },
} as const;

function ChartFrame({
  title,
  description,
  children,
  className,
  height = 260,
}: {
  title?: string;
  description?: string;
  children: React.ReactElement;
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("w-full", className)}>
      {title ? (
        <div className="mb-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export type ScoreTrendDatum = {
  date: string;
  overall: number;
  goal: number;
  coreTask: number;
  consistency: number;
};

/** Score history — the Goal Total Score (the headline) alongside the still-tracked
 *  core-task and consistency curves. */
export function ScoreTrendChart({
  data,
  title,
  description,
  height,
}: {
  data: ScoreTrendDatum[];
  title?: string;
  description?: string;
  height?: number;
}) {
  return (
    <ChartFrame title={title} description={description} height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          minTickGap={24}
          {...AXIS}
        />
        <YAxis domain={[0, 100]} {...AXIS} />
        <Tooltip {...tooltipStyle} />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="goal"
          name="Goals"
          stroke={COLORS.primary}
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="coreTask"
          name="Core tasks"
          stroke={COLORS.sky}
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="consistency"
          name="Consistency"
          stroke={COLORS.violet}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

/** One metric over time, filled. Group and organization trends. */
export function AreaTrendChart({
  data,
  dataKey,
  label,
  color = COLORS.primary,
  title,
  description,
  height,
  domain = [0, 100],
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  label: string;
  color?: string;
  title?: string;
  description?: string;
  height?: number;
  domain?: [number, number];
}) {
  const gradientId = `grad-${dataKey}`;

  return (
    <ChartFrame title={title} description={description} height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          minTickGap={24}
          {...AXIS}
        />
        <YAxis domain={domain} {...AXIS} />
        <Tooltip {...tooltipStyle} />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ChartFrame>
  );
}

/** Daily core-task completion. Bars are coloured by how good the day was. */
export function TaskCompletionChart({
  data,
  title,
  description,
  height,
}: {
  data: { date: string; percent: number }[];
  title?: string;
  description?: string;
  height?: number;
}) {
  const barColor = (percent: number) =>
    percent >= 80
      ? COLORS.emerald
      : percent >= 60
        ? COLORS.sky
        : percent >= 40
          ? COLORS.amber
          : COLORS.rose;

  return (
    <ChartFrame title={title} description={description} height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          minTickGap={24}
          {...AXIS}
        />
        <YAxis domain={[0, 100]} {...AXIS} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, "Completed"]} />
        <Bar dataKey="percent" radius={[3, 3, 0, 0]} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.date} fill={barColor(d.percent)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** The three goal categories, side by side. */
export function CategoryRadarChart({
  data,
  title,
  description,
  height,
}: {
  data: { name: string; score: number }[];
  title?: string;
  description?: string;
  height?: number;
}) {
  return (
    <ChartFrame title={title} description={description} height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={COLORS.grid} />
        <PolarAngleAxis
          dataKey="name"
          tick={{ fill: COLORS.axis, fontSize: 11 }}
        />
        <Tooltip {...tooltipStyle} />
        <Radar
          name="Score"
          dataKey="score"
          stroke={COLORS.primary}
          strokeWidth={2}
          fill={COLORS.primary}
          fillOpacity={0.18}
        />
      </RadarChart>
    </ChartFrame>
  );
}

/** Horizontal comparison — coaches against each other, groups against each other. */
export function ComparisonBarChart({
  data,
  title,
  description,
  height,
}: {
  data: { name: string; value: number }[];
  title?: string;
  description?: string;
  height?: number;
}) {
  const barColor = (v: number) =>
    v >= 80
      ? COLORS.emerald
      : v >= 60
        ? COLORS.sky
        : v >= 40
          ? COLORS.amber
          : COLORS.rose;

  return (
    <ChartFrame
      title={title}
      description={description}
      height={height ?? Math.max(160, data.length * 44)}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} {...AXIS} />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tick={{ fill: COLORS.axis, fontSize: 11 }}
          {...AXIS}
        />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="value" name="Score" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.name} fill={barColor(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function MoodChart({
  data,
  title,
  description,
  height,
}: {
  data: { date: string; mood: number | null }[];
  title?: string;
  description?: string;
  height?: number;
}) {
  return (
    <ChartFrame title={title} description={description} height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          minTickGap={24}
          {...AXIS}
        />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
        <Tooltip {...tooltipStyle} />
        <Line
          type="monotone"
          dataKey="mood"
          name="Mood"
          stroke={COLORS.amber}
          strokeWidth={2}
          dot={{ r: 2.5, fill: COLORS.amber, strokeWidth: 0 }}
          connectNulls={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

/**
 * Streak history as a calendar grid. A run of filled cells reads as a streak and
 * a gap reads as a gap — which a line chart would smooth away.
 */
export function StreakHeatmap({
  data,
  title,
  description,
}: {
  data: { date: string; kept: boolean }[];
  title?: string;
  description?: string;
}) {
  return (
    <div>
      {title ? (
        <div className="mb-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {data.map((day) => (
          <div
            key={day.date}
            title={`${day.date} — ${day.kept ? "kept" : "missed"}`}
            className={cn(
              "size-4 rounded-[3px] transition-colors",
              day.kept
                ? "bg-emerald-500"
                : "bg-surface-sunken ring-1 ring-inset ring-border",
            )}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-emerald-500" /> Kept
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-surface-sunken ring-1 ring-inset ring-border" />
          Missed
        </span>
      </div>
    </div>
  );
}
