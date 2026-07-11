'use client';

import {Box, Card, CardContent, Skeleton, Typography} from '@mui/material';

import type {MembershipStats} from '@/src/lib/effect/schemas';

interface StatsCardsProps {
  stats: MembershipStats | null;
  loading: boolean;
}

const statCards = [
  {key: 'totalMembers', label: 'Total Members', color: '#F20E02'},
  {key: 'activeMembers', label: 'Active', color: '#1F8A5B'},
  {key: 'expiredMembers', label: 'Expired', color: '#C7801A'},
  {key: 'canceledMembers', label: 'Canceled', color: '#C23A2B'},
  {key: 'individualCount', label: 'Individual Plans', color: '#7b1fa2'},
  {key: 'familyCount', label: 'Family Plans', color: '#0288d1'},
] as const;

export function StatsCards({stats, loading}: StatsCardsProps) {
  return (
    <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr 1fr', md: 'repeat(4, 1fr)', xl: 'repeat(7, 1fr)'}, gap: 2}}>
      {statCards.map(({key, label, color}) => (
        <Card key={key} sx={{bgcolor: 'var(--dec-surface)', minHeight: 118}}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={58} height={46} />
            ) : (
              <Typography sx={{fontFamily: 'Anton, sans-serif', fontSize: 34, color, mt: .5}}>
                {stats?.[key] ?? ''}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}

      <Card sx={{bgcolor: '#16130F', color: '#fff', minHeight: 118, gridColumn: {xs: 'span 2', md: 'span 2', xl: 'span 1'}}}>
        <CardContent>
          <Typography variant="body2" sx={{color: '#B8B8BD'}}>
            Annual Revenue
          </Typography>
          {loading ? (
            <Skeleton width={90} height={46} sx={{bgcolor: 'rgba(255,255,255,.16)'}} />
          ) : (
            <Typography sx={{fontFamily: 'Anton, sans-serif', fontSize: 34, color: '#7CF3A0', mt: .5}}>
              {stats?.yearlyRevenue != null ? `$${stats.yearlyRevenue.toLocaleString()}` : ''}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
