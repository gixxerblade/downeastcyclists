'use client';

import {SyncAlt} from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {useState} from 'react';

interface ReconciliationReport {
  email: string;
  stripeData: {
    customerId: string;
    customerEmail: string;
    subscriptionId: string;
    subscriptionStatus: string;
    priceId: string;
    planType: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  firebaseData: {
    userId: string;
    userEmail: string;
    membership: {
      id: string;
      stripeSubscriptionId: string;
      status: string;
      planType: string;
      startDate: string;
      endDate: string;
      autoRenew: boolean;
    } | null;
    card: {
      membershipNumber: string;
      status: string;
      planType: string;
      validFrom: string;
      validUntil: string;
    } | null;
  } | null;
  discrepancies: string[];
  canReconcile: boolean;
  reconcileActions: string[];
}

interface ReconciliationResult {
  success: boolean;
  email: string;
  actionsPerformed: string[];
  membershipUpdated: boolean;
  cardUpdated: boolean;
  cardCreated: boolean;
  userCreated: boolean;
  error?: string;
}

export function ReconciliationTool() {
  const [email, setEmail] = useState('');
  const [report, setReport] = useState<ReconciliationReport | null>(null);

  const validateMutation = useMutation({
    mutationFn: async (emailToValidate: string) => {
      const response = await fetch(
        `/api/admin/reconcile?email=${encodeURIComponent(emailToValidate)}`,
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Validation failed');
      }
      return response.json() as Promise<ReconciliationReport>;
    },
    onSuccess: setReport,
  });

  const reconcileMutation = useMutation({
    mutationFn: async (emailToReconcile: string) => {
      const response = await fetch('/api/admin/reconcile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: emailToReconcile}),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Reconciliation failed');
      }
      return response.json() as Promise<ReconciliationResult>;
    },
    onSuccess: () => {
      // Re-validate to show updated state
      validateMutation.mutate(email);
    },
  });

  const handleSearch = () => {
    if (!email.trim()) return;
    setReport(null);
    validateMutation.mutate(email.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
          <SyncAlt color="primary" />
          <Typography variant="h6">Stripe/Firebase Reconciliation</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
          Validate and sync membership data between Stripe and Firebase. Use this tool when a
          customer reports they paid but don&apos;t have access to their member dashboard.
        </Typography>

        <Stack direction="row" spacing={2} sx={{mb: 3}}>
          <TextField
            label="Member Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            placeholder="member@example.com"
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={!email.trim() || validateMutation.isPending}
            sx={{minWidth: 120}}
          >
            {validateMutation.isPending ? <CircularProgress size={20} /> : 'Validate'}
          </Button>
        </Stack>

        {validateMutation.error && (
          <Alert severity="error" sx={{mb: 2}}>
            {validateMutation.error.message}
          </Alert>
        )}

        {report && (
          <>
            <Divider sx={{my: 2}} />

            {/* Discrepancies */}
            {report.discrepancies.length > 0 && report.discrepancies[0] !== 'NO_DISCREPANCY' ? (
              <Alert severity="warning" sx={{mb: 2}}>
                <AlertTitle>Discrepancies Found</AlertTitle>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {report.discrepancies.map((d) => (
                    <Chip key={d} label={d.replace(/_/g, ' ')} size="small" color="warning" />
                  ))}
                </Stack>
              </Alert>
            ) : (
              <Alert severity="success" sx={{mb: 2}}>
                No discrepancies - data is in sync
              </Alert>
            )}

            {/* Comparison Table */}
            <Stack direction={{xs: 'column', md: 'row'}} spacing={2} sx={{mb: 2}}>
              {/* Stripe Data */}
              <Box flex={1}>
                <Typography variant="subtitle2" color="primary" sx={{mb: 1}}>
                  Stripe Data
                </Typography>
                {report.stripeData ? (
                  <Box
                    sx={{
                      fontSize: '0.875rem',
                      bgcolor: 'grey.50',
                      p: 2,
                      borderRadius: 1,
                      '& > div': {mb: 0.5},
                    }}
                  >
                    <div>
                      <strong>Customer:</strong> {report.stripeData.customerId}
                    </div>
                    <div>
                      <strong>Subscription:</strong> {report.stripeData.subscriptionId}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <Chip
                        label={report.stripeData.subscriptionStatus}
                        size="small"
                        color={
                          report.stripeData.subscriptionStatus === 'active' ? 'success' : 'default'
                        }
                      />
                    </div>
                    <div>
                      <strong>Plan:</strong> {report.stripeData.planType}
                    </div>
                    <div>
                      <strong>Period End:</strong>{' '}
                      {new Date(report.stripeData.currentPeriodEnd).toLocaleDateString()}
                    </div>
                    {report.stripeData.cancelAtPeriodEnd && (
                      <div>
                        <Chip label="Cancels at period end" size="small" color="warning" />
                      </div>
                    )}
                  </Box>
                ) : (
                  <Alert severity="error" variant="outlined">
                    No Stripe subscription found
                  </Alert>
                )}
              </Box>

              {/* Firebase Data */}
              <Box flex={1}>
                <Typography variant="subtitle2" color="secondary" sx={{mb: 1}}>
                  Firebase Data
                </Typography>
                {report.firebaseData ? (
                  <Box
                    sx={{
                      fontSize: '0.875rem',
                      bgcolor: 'grey.50',
                      p: 2,
                      borderRadius: 1,
                      '& > div': {mb: 0.5},
                    }}
                  >
                    <div>
                      <strong>User ID:</strong> {report.firebaseData.userId}
                    </div>
                    {report.firebaseData.membership ? (
                      <>
                        <div>
                          <strong>Status:</strong>{' '}
                          <Chip
                            label={report.firebaseData.membership.status}
                            size="small"
                            color={
                              report.firebaseData.membership.status === 'active'
                                ? 'success'
                                : 'default'
                            }
                          />
                        </div>
                        <div>
                          <strong>Plan:</strong> {report.firebaseData.membership.planType}
                        </div>
                        <div>
                          <strong>End Date:</strong>{' '}
                          {new Date(report.firebaseData.membership.endDate).toLocaleDateString()}
                        </div>
                      </>
                    ) : (
                      <Alert severity="error" variant="outlined" sx={{mt: 1}}>
                        No membership document
                      </Alert>
                    )}
                    {report.firebaseData.card ? (
                      <div style={{marginTop: 8}}>
                        <strong>Card:</strong> {report.firebaseData.card.membershipNumber}
                      </div>
                    ) : (
                      <Alert severity="error" variant="outlined" sx={{mt: 1}}>
                        No card document
                      </Alert>
                    )}
                  </Box>
                ) : (
                  <Alert severity="error" variant="outlined">
                    No Firebase user found
                  </Alert>
                )}
              </Box>
            </Stack>

            {/* Actions Preview */}
            {report.reconcileActions.length > 0 && report.canReconcile && (
              <Alert severity="info" sx={{mb: 2}}>
                <AlertTitle>Reconcile Actions</AlertTitle>
                <ul style={{margin: 0, paddingLeft: 20}}>
                  {report.reconcileActions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Reconcile Button */}
            {report.canReconcile && (
              <Button
                variant="contained"
                color="warning"
                onClick={() => reconcileMutation.mutate(email)}
                disabled={reconcileMutation.isPending}
                fullWidth
                startIcon={
                  reconcileMutation.isPending ? <CircularProgress size={16} /> : <SyncAlt />
                }
              >
                {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile Now'}
              </Button>
            )}

            {/* Result */}
            {reconcileMutation.isSuccess && (
              <Alert severity="success" sx={{mt: 2}}>
                <AlertTitle>Reconciliation Complete</AlertTitle>
                <ul style={{margin: 0, paddingLeft: 20}}>
                  {reconcileMutation.data.actionsPerformed.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {reconcileMutation.isError && (
              <Alert severity="error" sx={{mt: 2}}>
                Reconciliation failed: {reconcileMutation.error.message}
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
