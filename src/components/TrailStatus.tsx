'use client';

import {Refresh as RefreshIcon} from '@mui/icons-material';
import {Box, Card, CardContent, Typography, Chip, CircularProgress, Button} from '@mui/material';

import {useTrails} from '@/src/hooks/useTrailQueries';

interface TrailStatusProps {
  showTitle?: boolean;
  variant?: 'cards' | 'band' | 'hero';
  maxItems?: number;
}

export default function TrailStatus({
  showTitle = true,
  variant = 'cards',
  maxItems,
}: TrailStatusProps) {
  const {data: trails = [], isLoading, isError, error, refetch} = useTrails();
  const visibleTrails = maxItems ? trails.slice(0, maxItems) : trails;

  if (isLoading) {
    return (
      <Box sx={{display: 'flex', justifyContent: 'center', p: variant === 'hero' ? 0 : 3}}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{p: 2}}>
        <Typography color="error">
          Failed to load trail status: {error instanceof Error ? error.message : 'Unknown error'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          sx={{mt: 2}}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (trails.length === 0) {
    return (
      <Box sx={{p: 2}}>
        <Typography>No trail status information available.</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          sx={{mt: 2}}
        >
          Refresh
        </Button>
      </Box>
    );
  }

  if (variant === 'hero') {
    const trail = visibleTrails[0];
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          width: 'max-content',
          color: '#C8C8CC',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '.06em',
        }}
      >
        <Box
          component="span"
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: trail.open ? '#22c55e' : '#F20E02',
            boxShadow: `0 0 0 4px ${trail.open ? 'rgba(34,197,94,.2)' : 'rgba(242,14,2,.2)'}`,
          }}
        />
        {trail.trail.toUpperCase()} -{' '}
        <Box component="span" sx={{color: trail.open ? '#7CF3A0' : '#F58C84'}}>
          {trail.open ? 'OPEN TODAY' : 'CLOSED'}
        </Box>
      </Box>
    );
  }

  if (variant === 'band') {
    return (
      <Box
        sx={{
          bgcolor: '#F20E02',
          color: '#fff',
          py: {xs: 2.25, md: 2.75},
        }}
      >
        <Box
          className="dec-container"
          sx={{
            display: 'flex',
            alignItems: {xs: 'flex-start', md: 'center'},
            justifyContent: 'space-between',
            gap: 2,
            flexDirection: {xs: 'column', md: 'row'},
          }}
        >
          <Box sx={{display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap'}}>
            <Typography
              component="h2"
              sx={{fontFamily: 'Anton, sans-serif', fontSize: {xs: 18, md: 24}, lineHeight: 1}}
            >
              LIVE TRAIL STATUS
            </Typography>
            <Typography sx={{fontSize: 13, color: 'rgba(255,255,255,.75)', fontWeight: 600}}>
              updated from club trail data
            </Typography>
          </Box>
          <Box sx={{display: 'flex', gap: 1.25, flexWrap: 'wrap'}}>
            {visibleTrails.map((trail) => (
              <Box
                key={trail.id}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'rgba(0,0,0,.18)',
                  px: 2,
                  py: 1.1,
                  borderRadius: {xs: 1.5, md: 999},
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: trail.open ? '#7CF3A0' : '#F5A623',
                  }}
                />
                {trail.trail} - {trail.open ? 'Open' : 'Closed'}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{mb: 4}}>
      {showTitle && (
        <Typography variant="h5" component="h2" gutterBottom sx={{fontWeight: 800}}>
          Trail Status
        </Typography>
      )}

      <Box sx={{display: 'grid', gap: 2}}>
        {visibleTrails.map((trail) => (
          <Card
            key={trail.id}
            sx={{bgcolor: 'var(--dec-surface)', borderColor: 'var(--dec-border)'}}
          >
            <CardContent>
              <Box
                sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}
              >
                <Typography variant="h6" component="h3">
                  {trail.trail}
                </Typography>
                <Chip
                  label={trail.open ? 'Open' : 'Closed'}
                  color={trail.open ? 'success' : 'error'}
                  size="small"
                  sx={{fontWeight: 800, borderRadius: 999}}
                />
              </Box>
              {trail.notes && (
                <Typography variant="body2" color="text.secondary">
                  {trail.notes}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
