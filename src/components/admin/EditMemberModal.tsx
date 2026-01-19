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
  Typography,
  Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState, useEffect} from 'react';

import {updateMember} from '@/src/lib/effect/client-admin';
import type {MemberWithMembership} from '@/src/lib/effect/schemas';
import type {UpdateMemberInput, UpdateMemberResponse} from '@/src/types/admin';

interface EditMemberModalProps {
  open: boolean;
  member: MemberWithMembership | null;
  onClose: () => void;
}

/**
 * Safely converts a date value to ISO date string (YYYY-MM-DD)
 * Handles Firestore Timestamps, Date objects, and date strings
 * Returns empty string if the date is invalid
 */
function toISODateString(dateValue: unknown): string {
  if (!dateValue) return '';

  // Handle Firestore Timestamp objects
  if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
    const date = (dateValue as {toDate: () => Date}).toDate();
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  // Handle Date objects and date strings
  const date = new Date(dateValue as string | number | Date);

  // Check if date is valid
  if (isNaN(date.getTime())) return '';

  return date.toISOString().split('T')[0];
}

export function EditMemberModal({open, member, onClose}: EditMemberModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<UpdateMemberInput>({
    email: '',
    name: '',
    phone: '',
    planType: undefined,
    startDate: '',
    endDate: '',
    status: undefined,
    stripeCustomerId: '',
    reason: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      const startDate = toISODateString(member.membership?.startDate);
      const endDate = toISODateString(member.membership?.endDate);

      setFormData({
        email: member.user?.email || '',
        name: member.user?.name || '',
        phone: member.user?.phone || '',
        planType: member.membership?.planType,
        startDate,
        endDate,
        status: member.membership?.status,
        stripeCustomerId: member.user?.stripeCustomerId || '',
        reason: '',
      });
    }
  }, [member]);

  const updateMutation = useMutation<
    UpdateMemberResponse,
    Error,
    {userId: string; input: UpdateMemberInput}
  >({
    mutationFn: ({userId, input}) => Effect.runPromise(updateMember(userId, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['admin', 'members']});
      queryClient.invalidateQueries({queryKey: ['admin', 'stats']});
      handleClose();
    },
  });

  const handleClose = () => {
    setValidationError(null);
    updateMutation.reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!member?.user?.id) {
      setValidationError('Member not found');
      return;
    }

    if (!formData.reason.trim()) {
      setValidationError('Please provide a reason for this change');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setValidationError('Please enter a valid email address');
      return;
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) {
        setValidationError('End date must be after start date');
        return;
      }
    }

    setValidationError(null);

    // Only send changed fields
    const changes: UpdateMemberInput = {reason: formData.reason};

    if (formData.email !== member.user?.email) changes.email = formData.email;
    if (formData.name !== (member.user?.name || '')) changes.name = formData.name;
    if (formData.phone !== (member.user?.phone || '')) changes.phone = formData.phone;
    if (formData.planType !== member.membership?.planType) changes.planType = formData.planType;
    if (formData.status !== member.membership?.status) changes.status = formData.status;
    if (formData.stripeCustomerId !== (member.user?.stripeCustomerId || '')) {
      changes.stripeCustomerId = formData.stripeCustomerId;
    }

    const originalStartDate = toISODateString(member.membership?.startDate);
    const originalEndDate = toISODateString(member.membership?.endDate);

    if (formData.startDate !== originalStartDate) changes.startDate = formData.startDate;
    if (formData.endDate !== originalEndDate) changes.endDate = formData.endDate;

    updateMutation.mutate({userId: member.user.id, input: changes});
  };

  const handleInputChange = (field: keyof UpdateMemberInput, value: string | undefined) => {
    setFormData((prev) => ({...prev, [field]: value}));
  };

  if (!member) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Member</DialogTitle>
      <DialogContent>
        <Box sx={{pt: 2}}>
          {(validationError || updateMutation.error) && (
            <Alert severity="error" sx={{mb: 2}}>
              {validationError || updateMutation.error?.message}
            </Alert>
          )}

          {updateMutation.data?.emailSyncedToStripe && (
            <Alert severity="info" sx={{mb: 2}}>
              Email was synced to Stripe customer record
            </Alert>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{mb: 2}}>
            Membership #: {member.card?.membershipNumber || 'N/A'}
          </Typography>

          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                helperText={
                  member.user?.stripeCustomerId
                    ? 'Warning: Changing email will update Stripe customer'
                    : undefined
                }
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

            <Grid size={12}>
              <Divider sx={{my: 1}} />
              <Typography variant="subtitle2" sx={{mb: 1}}>
                Membership Details
              </Typography>
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <FormControl fullWidth>
                <InputLabel>Plan Type</InputLabel>
                <Select
                  value={formData.planType || ''}
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
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || ''}
                  label="Status"
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="past_due">Past Due</MenuItem>
                  <MenuItem value="canceled">Canceled</MenuItem>
                  <MenuItem value="incomplete">Incomplete</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{xs: 12, sm: 6}}>
              <TextField
                fullWidth
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
                label="Stripe Customer ID"
                value={formData.stripeCustomerId}
                onChange={(e) => handleInputChange('stripeCustomerId', e.target.value)}
                placeholder="cus_xxxxxxxx"
              />
            </Grid>

            <Grid size={12}>
              <Divider sx={{my: 1}} />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                required
                multiline
                rows={2}
                label="Reason for Change"
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="Explain why you are making this change"
                helperText="Required for audit trail"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={updateMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
          startIcon={updateMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
