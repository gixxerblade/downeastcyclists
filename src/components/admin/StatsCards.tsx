"use client";

import type { MembershipStats } from "@/src/lib/effect/schemas";
import { Grid2, Paper, styled, Typography } from "@mui/material";

interface StatsCardsProps {
  stats: MembershipStats | null;
  loading: boolean;
}

const statCards = [
  { key: "totalMembers", label: "Total Members", color: "#1976d2" },
  { key: "activeMembers", label: "Active", color: "#2e7d32" },
  { key: "expiredMembers", label: "Expired", color: "#ed6c02" },
  { key: "canceledMembers", label: "Canceled", color: "#d32f2f" },
  { key: "individualCount", label: "Individual Plans", color: "#7b1fa2" },
  { key: "familyCount", label: "Family Plans", color: "#0288d1" },
] as const;

const Item = styled(Paper)(({ color, theme }) => ({
  backgroundColor: "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color,
}));

export function StatsCards({ stats, loading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
      <Grid2 container spacing={2}>
        {statCards.map(({ key, label, color }) => (
          <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={key}>
            <Item>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h6" sx={{ color, mt: 0.5 }}>
                {stats?.[key]}
              </Typography>
            </Item>
          </Grid2>
        ))}
      </Grid2>

      {/* Revenue card */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200 col-span-2 sm:col-span-3 md:col-span-2">
        <p className="text-sm text-gray-600 mb-1">Annual Revenue</p>
        {loading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse w-24" />
        ) : (
          <p className="text-3xl font-bold text-green-700">
            ${stats?.yearlyRevenue?.toLocaleString() ?? 0}
          </p>
        )}
      </div>
    </div>
  );
}
