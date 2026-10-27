"use client";

import React, { useState, useMemo } from "react";
import { Order } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";

interface OperationsTimelineChartProps {
  orders: Order[];
}

export default function OperationsTimelineChart({ orders }: OperationsTimelineChartProps) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [rangeDays, setRangeDays] = useState<7 | 14>(7);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Group orders into daily buckets
  const chartData = useMemo(() => {
    const days: { date: string; label: string; revenue: number; orders: number }[] = [];
    const now = new Date();

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      // Match orders placed on this day
      const dayOrders = orders.filter((o) => {
        if (!o.createdAt) return false;
        const oDate = new Date(o.createdAt).toISOString().split("T")[0];
        return oDate === dateKey;
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      days.push({
        date: dateKey,
        label,
        revenue: dayRevenue,
        orders: dayOrders.length,
      });
    }

    return days;
  }, [orders, rangeDays]);

  // Determine scale
  const values = chartData.map((d) => (metric === "revenue" ? d.revenue : d.orders));
  const rawMax = Math.max(...values, metric === "revenue" ? 100000 : 5);
  // Round max value up for nice ceiling
  const maxVal = metric === "revenue" ? Math.ceil(rawMax / 50000) * 50000 : Math.ceil(rawMax / 5) * 5;

  const width = 640;
  const height = 210;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = chartData.map((d, i) => {
    const val = metric === "revenue" ? d.revenue : d.orders;
    const x = padLeft + (i / (chartData.length - 1)) * chartW;
    const y = padTop + chartH - (val / (maxVal || 1)) * chartH;
    return { x, y, ...d, value: val };
  });

  // Build SVG path
  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

  // Grid levels (0%, 50%, 100%)
  const gridLevels = [
    { ratio: 1, val: maxVal },
    { ratio: 0.5, val: Math.round(maxVal / 2) },
    { ratio: 0, val: 0 },
  ];

  const formatYAxis = (val: number) => {
    if (metric === "orders") return val.toString();
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}k`;
    return `₦${val}`;
  };

  const strokeColor = metric === "revenue" ? "#ea580c" : "#2563eb";

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      {/* Chart Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: strokeColor }}
            />
            <h3 className="text-sm font-semibold text-slate-900">
              {metric === "revenue" ? "Sales & Revenue Trajectory" : "Order Volume Velocity"}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational trend line based on verified store checkouts
          </p>
        </div>

        {/* Flat Buttons Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="bg-slate-100 p-0.5 rounded-md flex items-center border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setMetric("revenue")}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                metric === "revenue"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Revenue (₦)
            </button>
            <button
              onClick={() => setMetric("orders")}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                metric === "orders"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Orders
            </button>
          </div>

          <div className="bg-slate-100 p-0.5 rounded-md flex items-center border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setRangeDays(7)}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                rangeDays === 7
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setRangeDays(14)}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                rangeDays === 14
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              14D
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 sm:h-56 overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Horizontal Grid lines */}
          {gridLevels.map((g, idx) => {
            const y = padTop + chartH * (1 - g.ratio);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-sans"
                >
                  {formatYAxis(g.val)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill={strokeColor} fillOpacity="0.08" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points and Interaction Circles */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Target hover area */}
                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />

                {/* Point dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#ffffff"
                  stroke={strokeColor}
                  strokeWidth={isHovered ? "3" : "2"}
                  className="transition-all duration-150"
                />

                {/* X-axis date label */}
                <text
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-sans ${
                    isHovered ? "fill-slate-900 font-bold" : "fill-slate-400"
                  }`}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute pointer-events-none z-20 bg-slate-900 text-white px-3 py-2 rounded-md shadow-md text-xs border border-slate-700 whitespace-nowrap -translate-x-1/2 -translate-y-full transition-all"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100 - 10}%`,
            }}
          >
            <p className="text-[10px] text-slate-400 font-medium">{points[hoveredIdx].label}</p>
            <p className="font-bold text-white text-xs mt-0.5">
              {formatCurrency("NGN", points[hoveredIdx].revenue)}
            </p>
            <p className="text-[10px] text-slate-300">
              {points[hoveredIdx].orders} {points[hoveredIdx].orders === 1 ? "order" : "orders"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
