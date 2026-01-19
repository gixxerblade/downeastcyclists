'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {deleteMember} from '@/src/lib/effect/client-admin';
import type {MemberWithMembership} from '@/src/lib/effect/schemas';
import type {DeleteMemberInput, DeleteMemberResponse} from '@/src/types/admin';

interface DeleteMemberDialogProps {
  open: boolean;
  member: MemberWithMembership | null;
  onClose: () => void;
}

export function DeleteMemberDialog({open, member, onClose}: DeleteMemberDialogProps) {
  const queryClient = useQueryClient();

  const [reason, setReason] = useState('');
  const [cancelStripeSubscription, setCancelStripeSubscription] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasStripeSubscription = !!member?.user?.stripeCustomerId;

  const deleteMutation = useMutation<
    DeleteMemberResponse,
    Error,
    {userId: string; input: DeleteMemberInput}
  >({
    mutationFn: ({userId, input}) => Effect.runPromise(deleteMember(userId, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['admin', 'members']});
      queryClient.invalidateQueries({queryKey: ['admin', 'stats']});
      handleClose();
    },
  });

  const handleClose = () => {
    setReason('');
    setCancelStripeSubscription(true);
    setConfirmText('');
    setValidationError(null);
    deleteMutation.reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!member?.user?.id) {
      setValidationError('Member not found');
      return;
    }

    if (!reason.trim()) {
      setValidationError('Please provide a reason for deletion');
      return;
    }

    if (confirmText !== 'DELETE') {
      setValidationError('Please type DELETE to confirm');
      return;
    }

    setValidationError(null);
    deleteMutation.mutate({
      userId: member.user.id,
      input: {
        reason,
        cancelStripeSubscription: hasStripeSubscription && cancelStripeSubscription,
      },
    });
  };

  if (!member) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{color: 'error.main'}}>Delete Member</DialogTitle>
      <DialogContent>
        <Box sx={{pt: 2}}>
          <Alert severity="warning" sx={{mb: 2}}>
            <Typography variant="body2">
              <strong>This action will:</strong>
            </Typography>
            <ul style={{margin: '8px 0', paddingLeft: 20}}>
              <li>Mark the member as deleted (soft delete)</li>
              <li>Invalidate their membership card</li>
              <li>Remove their access immediately</li>
              {hasStripeSubscription && cancelStripeSubscription && (
                <li>Cancel their Stripe subscription</li>
              )}
            </ul>
            <Typography variant="body2">
              <strong>Data will be retained</strong> for audit purposes.
            </Typography>
          </Alert>

          {(validationError || deleteMutation.error) && (
            <Alert severity="error" sx={{mb: 2}}>
              {validationError || deleteMutation.error?.message}
            </Alert>
          )}

          <Box sx={{mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1}}>
            <Typography variant="subtitle2">Member Details</Typography>
            <Typography variant="body2">Name: {member.user?.name || 'N/A'}</Typography>
            <Typography variant="body2">Email: {member.user?.email}</Typography>
            <Typography variant="body2">
              Membership #: {member.card?.membershipNumber || 'N/A'}
            </Typography>
            <Typography variant="body2">Status: {member.membership?.status || 'N/A'}</Typography>
          </Box>

          <TextField
            fullWidth
            required
            multiline
            rows={2}
            label="Reason for Deletion"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this member is being deleted"
            sx={{mb: 2}}
          />

          {hasStripeSubscription && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={cancelStripeSubscription}
                  onChange={(e) => setCancelStripeSubscription(e.target.checked)}
                />
              }
              label="Cancel Stripe subscription immediately"
            />
          )}

          <Alert severity="error" sx={{mt: 2, mb: 2}}>
            To confirm deletion, type <strong>DELETE</strong> below:
          </Alert>

          <TextField
            fullWidth
            label="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            error={confirmText !== '' && confirmText !== 'DELETE'}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={deleteMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={deleteMutation.isPending || confirmText !== 'DELETE'}
          startIcon={deleteMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Member'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
