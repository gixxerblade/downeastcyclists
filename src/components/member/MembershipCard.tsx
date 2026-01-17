'use client';

import {Card, CardContent, Typography, Box, Chip, LinearProgress} from '@mui/material';

import type {MemberDashboardResponse} from '@/src/lib/effect/schemas';

interface MembershipCardProps {
  membership: NonNullable<MemberDashboardResponse['membership']>;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  canceled: 'error',
  incomplete: 'warning',
  incomplete_expired: 'error',
  unpaid: 'error',
};

export function MembershipCard({membership}: MembershipCardProps) {
  const endDate = new Date(membership.endDate);
  const startDate = new Date(membership.startDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const progress = ((totalDays - membership.daysRemaining) / totalDays) * 100;

  return (
    <Card>
      <CardContent>
        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 2}}>
          <Typography variant="h6">{membership.planName}</Typography>
          <Chip
            label={membership.status.replace('_', ' ')}
            color={statusColors[membership.status] || 'default'}
            size="small"
          />
        </Box>

        <Box sx={{mb: 2}}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Membership Progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{height: 8, borderRadius: 4}}
          />
        </Box>

        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
          <Typography variant="body2" color="text.secondary">
            Start Date
          </Typography>
          <Typography variant="body2">{startDate.toLocaleDateString()}</Typography>
        </Box>

        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
          <Typography variant="body2" color="text.secondary">
            End Date
          </Typography>
          <Typography variant="body2">{endDate.toLocaleDateString()}</Typography>
        </Box>

        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
          <Typography variant="body2" color="text.secondary">
            Days Remaining
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {membership.daysRemaining} days
          </Typography>
        </Box>

        <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
          <Typography variant="body2" color="text.secondary">
            Auto-Renew
          </Typography>
          <Typography variant="body2">{membership.autoRenew ? 'Yes' : 'No'}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
