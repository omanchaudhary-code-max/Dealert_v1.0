"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

const INDEX_PREVIEW_DATA = [
  { month: "Jan", index: 100 },
  { month: "Feb", index: 102.5 },
  { month: "Mar", index: 104.2 },
  { month: "Apr", index: 103.8 },
  { month: "May", index: 105.1 },
  { month: "Jun", index: 103.9 },
];

export default function DealertChart() {
  return (
    <div style={{ width: "100%", height: "calc(100% - 0px)" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={INDEX_PREVIEW_DATA}>
          <defs>
            <linearGradient id="colorIndex" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={10} domain={["dataMin - 5", "auto"]} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
          <Area type="monotone" dataKey="index" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIndex)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
