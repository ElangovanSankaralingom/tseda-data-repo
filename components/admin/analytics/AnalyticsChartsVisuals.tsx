"use client";

import { useMemo } from "react";
import { pct } from "./AnalyticsChartsCore";

export function AreaChart({
  data,
  previousData,
  width = 700,
  height = 200,
}: {
  data: { label: string; value: number }[];
  previousData?: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Not enough data for chart
      </div>
    );
  }

  const padY = 24;
  const padX = 40;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const allValues = [
    ...data.map((d) => d.value),
    ...(previousData ?? []).map((d) => d.value),
  ];
  const maxVal = Math.max(...allValues, 1);

  function toPoint(i: number, v: number) {
    const x = padX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const y = padY + chartH - (v / maxVal) * chartH;
    return { x, y };
  }

  const points = data.map((d, i) => toPoint(i, d.value));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padX},${padY + chartH} ${line} ${points[points.length - 1].x},${padY + chartH}`;

  const prevPoints = previousData?.map((d, i) => toPoint(i, d.value));
  const prevLine = prevPoints?.map((p) => `${p.x},${p.y}`).join(" ");

  const yLabels = [0, Math.round(maxVal / 2), maxVal];
  const xLabelIndices = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F172A" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yLabels.map((v) => {
        const y = padY + chartH - (v / maxVal) * chartH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#E2E8F0" strokeWidth="1" />
            <text x={padX - 6} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {v}
            </text>
          </g>
        );
      })}
      {prevLine && (
        <polyline
          points={prevLine}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
      <polygon points={area} fill="url(#areaFill)" />
      <polyline points={line} fill="none" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0F172A">
          <title>
            {data[i].label}: {data[i].value}
          </title>
        </circle>
      ))}
      {xLabelIndices.map((i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <text
            key={i}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-slate-400 text-[10px]"
          >
            {data[i].label}
          </text>
        );
      })}
    </svg>
  );
}

export function DonutChart({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pctVal = total > 0 ? s.value / total : 0;
      const dash = pctVal * circumference;
      const arc = { ...s, dash, gap: circumference - dash, offset };
      offset += dash;
      return arc;
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="16"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-500"
          >
            <title>
              {arc.label}: {arc.value} ({pct(arc.value, total)}%)
            </title>
          </circle>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-slate-900 text-2xl font-bold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-slate-400 text-[10px] uppercase tracking-wide"
        >
          entries
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="font-medium">{s.value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function Heatmap({ entries }: { entries: { date: string }[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.date] = (map[e.date] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  const weeks = useMemo(() => {
    const result: string[][] = [];
    const today = new Date();
    const startDay = new Date(today);
    startDay.setDate(startDay.getDate() - 83);
    while (startDay.getDay() !== 1) startDay.setDate(startDay.getDate() - 1);

    let current = new Date(startDay);
    let week: string[] = [];
    while (current <= today) {
      week.push(current.toISOString().slice(0, 10));
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    if (week.length > 0) result.push(week);
    return result;
  }, []);

  function cellColor(count: number) {
    if (count === 0) return "bg-slate-100";
    if (count <= 2) return "bg-emerald-200";
    if (count <= 5) return "bg-emerald-400";
    if (count <= 10) return "bg-emerald-600";
    return "bg-emerald-800";
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-1 pr-1 pt-0">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="flex h-3 w-4 items-center text-[9px] text-slate-400">
              {i % 2 === 0 ? d : ""}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((date) => {
              const c = counts[date] ?? 0;
              return (
                <div
                  key={date}
                  className={`size-3 rounded-sm ${cellColor(c)} transition-colors`}
                  title={`${date}: ${c} ${c === 1 ? "entry" : "entries"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <span>Less</span>
        <span className="size-3 rounded-sm bg-slate-100" />
        <span className="size-3 rounded-sm bg-emerald-200" />
        <span className="size-3 rounded-sm bg-emerald-400" />
        <span className="size-3 rounded-sm bg-emerald-600" />
        <span className="size-3 rounded-sm bg-emerald-800" />
        <span>More</span>
      </div>
    </div>
  );
}
