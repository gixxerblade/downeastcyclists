'use client';

import {OpenInNew} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {getPaymentHistory, issueRefund} from '@/src/lib/effect/client-admin';
import type {PaymentHistoryItem, RefundResponse} from '@/src/types/admin';

interface PaymentHistoryPanelProps {
  open: boolean;
  userId: string | null;
  memberName?: string;
  onClose: () => void;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  refunded: 'default',
};

export function PaymentHistoryPanel({open, userId, memberName, onClose}: PaymentHistoryPanelProps) {
  const queryClient = useQueryClient();
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ['admin', 'payment-history', userId],
    queryFn: () => (userId ? Effect.runPromise(getPaymentHistory(userId)) : Promise.resolve([])),
    enabled: open && !!userId,
  });

  const refundMutation = useMutation<RefundResponse, Error, {paymentIntentId: string}>({
    mutationFn: ({paymentIntentId}) =>
      userId
        ? Effect.runPromise(issueRefund(userId, {paymentIntentId}))
        : Promise.reject(new Error('No user ID')),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['admin', 'payment-history', userId]});
      setRefundingId(null);
    },
    onError: () => {
      setRefundingId(null);
    },
  });

  const handleRefund = (paymentIntentId: string) => {
    if (confirm('Are you sure you want to issue a full refund for this payment?')) {
      setRefundingId(paymentIntentId);
      refundMutation.mutate({paymentIntentId});
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Payment History
        {memberName && (
          <Typography variant="subtitle2" color="text.secondary">
            {memberName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{pt: 1}}>
          {historyQuery.isLoading && (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
              <CircularProgress />
            </Box>
          )}

          {historyQuery.error && (
            <Alert severity="error">
              {historyQuery.error.message || 'Failed to load payment history'}
            </Alert>
          )}

          {refundMutation.error && (
            <Alert severity="error" sx={{mb: 2}}>
              {refundMutation.error.message || 'Failed to issue refund'}
            </Alert>
          )}

          {refundMutation.data && (
            <Alert severity="success" sx={{mb: 2}}>
              Refund issued successfully (ID: {refundMutation.data.refundId})
            </Alert>
          )}

          {historyQuery.data && historyQuery.data.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{py: 4}}>
              No payment history found
            </Typography>
          )}

          {historyQuery.data && historyQuery.data.length > 0 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyQuery.data.map((payment: PaymentHistoryItem) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.description}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(payment.amount, payment.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={payment.status}
                          color={statusColors[payment.status] || 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {payment.invoiceUrl && (
                          <IconButton
                            size="small"
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.refundable && payment.paymentIntentId && (
                          <Button
                            size="small"
                            color="warning"
                            onClick={() => handleRefund(payment.paymentIntentId!)}
                            disabled={refundingId === payment.paymentIntentId}
                          >
                            {refundingId === payment.paymentIntentId ? 'Refunding...' : 'Refund'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
