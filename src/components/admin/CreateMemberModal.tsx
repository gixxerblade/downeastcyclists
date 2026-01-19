'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {createMember} from '@/src/lib/effect/client-admin';
import type {CreateMemberInput, CreateMemberResponse} from '@/src/types/admin';

interface CreateMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateMemberModal({open, onClose}: CreateMemberModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateMemberInput>({
    email: '',
    name: '',
    phone: '',
    planType: 'individual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'active',
    stripeCustomerId: '',
    notes: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useMutation<CreateMemberResponse, Error, CreateMemberInput>({
    mutationFn: (input) => Effect.runPromise(createMember(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['admin', 'members']});
      queryClient.invalidateQueries({queryKey: ['admin', 'stats']});
      handleClose();
    },
  });

  const handleClose = () => {
    setFormData({
      email: '',
      name: '',
      phone: '',
      planType: 'individual',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active',
      stripeCustomerId: '',
      notes: '',
    });
    setValidationError(null);
    createMutation.reset();
    onClose();
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.email) {
      setValidationError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setValidationError('Please enter a valid email address');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    if (endDate <= startDate) {
      setValidationError('End date must be after start date');
      return;
    }

    setValidationError(null);
    createMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof CreateMemberInput, value: string) => {
    setFormData((prev) => ({...prev, [field]: value}));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Member</DialogTitle>
      <DialogContent>
        <Box sx={{pt: 2}}>
          {(validationError || createMutation.error) && (
            <Alert severity="error" sx={{mb: 2}}>
              {validationError || createMutation.error?.message}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                required
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <FormControl fullWidth required>
                <InputLabel>Plan Type</InputLabel>
                <Select
                  value={formData.planType}
                  label="Plan Type"
                  onChange={(e) =>
                    handleInputChange('planType', e.target.value as 'individual' | 'family')
                  }
                >
                  <MenuItem value="individual">Individual ($30/year)</MenuItem>
                  <MenuItem value="family">Family ($50/year)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) =>
                    handleInputChange(
                      'status',
                      e.target.value as 'active' | 'complimentary' | 'legacy',
                    )
                  }
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="complimentary">Complimentary</MenuItem>
                  <MenuItem value="legacy">Legacy (Migrated)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <TextField
                fullWidth
                required
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                InputLabelProps={{shrink: true}}
              />
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <TextField
                fullWidth
                required
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                InputLabelProps={{shrink: true}}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Stripe Customer ID (optional)"
                value={formData.stripeCustomerId}
                onChange={(e) => handleInputChange('stripeCustomerId', e.target.value)}
                placeholder="cus_xxxxxxxx"
                helperText="Link to existing Stripe customer for payment history"
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes (optional)"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Internal notes about this member"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          startIcon={createMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Member'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
