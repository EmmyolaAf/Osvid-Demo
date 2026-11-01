"use client";

import React, { useState, useMemo } from "react";
import { Order } from "@/types/auth";
import formatCurrency from "@/helpers/formatCurrency";
import { TrendingUp, ShoppingBag, Calendar, BarChart2 } from "lucide-react";

interface OperationsTimelineChartProps {
  orders: Order[];
}

export default function OperationsTimelineChart({ orders }: OperationsTimelineChartProps) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Group orders into daily buckets based on selected range
  const chartData = useMemo(() => {
    const days: { date: string; label: string; revenue: number; orders: number }[] = [];
    const now = new Date();

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

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

  // Aggregate metrics for summary header
  const totalInWindow = useMemo(() => {
    return chartData.reduce(
      (acc, d) => ({
        revenue: acc.revenue + d.revenue,
        orders: acc.orders + d.orders,
      }),
      { revenue: 0, orders: 0 }
    );
  }, [chartData]);

  const peakInWindow = useMemo(() => {
    const values = chartData.map((d) => (metric === "revenue" ? d.revenue : d.orders));
    return Math.max(...values, 0);
  }, [chartData, metric]);

  const dailyAvg = useMemo(() => {
    const total = metric === "revenue" ? totalInWindow.revenue : totalInWindow.orders;
    return Math.round(total / (rangeDays || 1));
  }, [totalInWindow, metric, rangeDays]);

  // SVG Dimension Calculations
  const values = chartData.map((d) => (metric === "revenue" ? d.revenue : d.orders));
  const rawMax = Math.max(...values, metric === "revenue" ? 100000 : 5);
  const maxVal = metric === "revenue" ? Math.ceil(rawMax / 50000) * 50000 : Math.ceil(rawMax / 5) * 5;

  const width = 800;
  const height = 240;
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

  // Smooth bezier curve generator
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

  const primaryColor = metric === "revenue" ? "#ea580c" : "#2563eb";
  const lightFillColor = metric === "revenue" ? "#fff7ed" : "#eff6ff";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
      {/* Chart Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Performance Analytics
            </span>
            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
              Live Verified
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
            {metric === "revenue" ? "Store Sales Velocity" : "Order Volume Trajectory"}
          </h2>
        </div>

        {/* Metric Selector & Date Range Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Pill Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setMetric("revenue")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === "revenue"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Revenue (₦)
            </button>
            <button
              onClick={() => setMetric("orders")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === "orders"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "hover:text-slate-900"
              }`}
            >
              Order Count
            </button>
          </div>

          {/* Date Range Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days as any)}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  rangeDays === days
                    ? "bg-slate-900 text-white shadow-xs"
                    : "hover:text-slate-900"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Snapshot Summary Cards */}
      <div className="grid grid-cols-3 gap-3 py-4 border-b border-slate-100 text-xs">
        <div>
          <span className="text-[11px] font-semibold text-slate-400">Period Total</span>
          <p className="text-sm font-black text-slate-900 mt-0.5">
            {metric === "revenue"
              ? formatCurrency("NGN", totalInWindow.revenue)
              : `${totalInWindow.orders} orders`}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400">Daily Average</span>
          <p className="text-sm font-black text-slate-900 mt-0.5">
            {metric === "revenue"
              ? formatCurrency("NGN", dailyAvg)
              : `${dailyAvg} orders/day`}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400">Peak Single Day</span>
          <p className="text-sm font-black text-slate-900 mt-0.5">
            {metric === "revenue"
              ? formatCurrency("NGN", peakInWindow)
              : `${peakInWindow} orders`}
          </p>
        </div>
      </div>

      {/* SVG Responsive Chart Viewport */}
      <div className="relative pt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y-axis labels */}
          {gridLevels.map((lvl, idx) => {
            const y = padTop + chartH * (1 - lvl.ratio);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray={idx === 2 ? "" : "4 4"}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {formatYAxis(lvl.val)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Data Points and X-Axis Labels */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i;
            const showLabel =
              rangeDays === 7 ||
              (rangeDays === 14 && i % 2 === 0) ||
              (rangeDays === 30 && i % 4 === 0) ||
              i === points.length - 1;

            return (
              <g key={i}>
                {/* X Axis Label */}
                {showLabel && (
                  <text
                    x={p.x}
                    y={height - 8}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {p.label}
                  </text>
                )}

                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={p.x}
                    y1={padTop}
                    x2={p.x}
                    y2={padTop + chartH}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Point circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? primaryColor : "#ffffff"}
                  stroke={primaryColor}
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150 cursor-pointer"
                />

                {/* Transparent hit area for easy hover */}
                <rect
                  x={p.x - 12}
                  y={padTop}
                  width="24"
                  height={chartH + 20}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100}%`,
            }}
          >
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {points[hoveredIdx].label}
            </p>
            <p className="font-extrabold text-sm text-orange-400">
              {formatCurrency("NGN", points[hoveredIdx].revenue)}
            </p>
            <p className="text-[11px] text-slate-300">
              {points[hoveredIdx].orders} completed {points[hoveredIdx].orders === 1 ? "order" : "orders"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
