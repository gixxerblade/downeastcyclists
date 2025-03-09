"use client";

import { Box, Card, CardContent, Typography, Chip, CircularProgress, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useTrails } from '@/src/hooks/useTrailQueries';

interface TrailStatusProps {
  showTitle?: boolean;
}

export default function TrailStatus({ showTitle = true }: TrailStatusProps) {
  const { 
    data: trails = [], 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useTrails();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">
          Failed to load trail status: {error instanceof Error ? error.message : 'Unknown error'}
        </Typography>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={() => refetch()} 
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (trails.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No trail status information available.</Typography>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={() => refetch()} 
          sx={{ mt: 2 }}
        >
          Refresh
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      {showTitle && (
        <Typography variant="h5" component="h2" gutterBottom>
          Trail Status
        </Typography>
      )}

      {trails.map((trail) => (
        <Card key={trail.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" component="h3">
                {trail.trail}
              </Typography>
              <Chip
                label={trail.open ? "Open" : "Closed"}
                color={trail.open ? "success" : "error"}
                size="small"
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
  );
}
