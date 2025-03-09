"use client";

import { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Switch, 
  TextField, 
  Button, 
  FormControlLabel,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { TrailData } from '@/src/utils/trails';
import { useTrails, useUpdateTrail } from '@/src/hooks/useTrailQueries';

export default function TrailStatusEditor() {
  const { data: trails = [], isLoading: isLoadingTrails } = useTrails();
  const updateTrailMutation = useUpdateTrail();
  
  const [editingTrails, setEditingTrails] = useState<{ [key: string]: TrailData }>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Initialize editing trails when data is loaded
  useEffect(() => {
    if (trails.length > 0) {
      setEditingTrails(
        trails.reduce((acc, trail) => ({ ...acc, [trail.id]: { ...trail } }), {})
      );
    }
  }, [trails]);

  const handleTrailChange = (id: string, field: keyof TrailData, value: any) => {
    setEditingTrails(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleUpdateTrail = async (id: string) => {
    try {
      const trailData = editingTrails[id];
      const { trail, open, notes } = trailData;
      
      await updateTrailMutation.mutateAsync({
        id,
        data: { trail, open, notes }
      });
      
      setSnackbar({
        open: true,
        message: `${trail} status updated successfully!`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error updating trail:', error);
      setSnackbar({
        open: true,
        message: `Failed to update trail status. Please try again.`,
        severity: 'error'
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Update Trail Status
      </Typography>
      
      {trails.map((trail) => (
        <Card key={trail.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {trail.trail}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={editingTrails[trail.id]?.open || false}
                    onChange={(e) => handleTrailChange(trail.id, 'open', e.target.checked)}
                    color="success"
                  />
                }
                label={editingTrails[trail.id]?.open ? "Open" : "Closed"}
              />
            </Box>
            
            <TextField
              fullWidth
              label="Status Notes"
              variant="outlined"
              value={editingTrails[trail.id]?.notes || ''}
              onChange={(e) => handleTrailChange(trail.id, 'notes', e.target.value)}
              margin="normal"
              multiline
              rows={2}
              placeholder="Enter any additional information about the trail status"
            />
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleUpdateTrail(trail.id)}
                disabled={updateTrailMutation.isPending && updateTrailMutation.variables?.id === trail.id}
                startIcon={(updateTrailMutation.isPending && updateTrailMutation.variables?.id === trail.id) ? <CircularProgress size={20} /> : null}
              >
                {(updateTrailMutation.isPending && updateTrailMutation.variables?.id === trail.id) ? 'Updating...' : 'Update Status'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
