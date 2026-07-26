'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {useMutation, useQuery} from '@tanstack/react-query';
import {useEffect, useState} from 'react';

import {PlanCard, type MembershipPlan} from './PlanCard';

interface RenewMembershipClientProps {
  renewalToken?: string;
  email?: string;
  name: string | null;
  canceled: boolean;
  expiredOn?: string;
  publicRenewal: boolean;
}

interface CheckoutResponse {
  url: string;
}

export function RenewMembershipClient({
  renewalToken,
  email,
  name,
  canceled,
  expiredOn,
  publicRenewal,
}: RenewMembershipClientProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState(0);
  const [coverFees, setCoverFees] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState('');

  const plansQuery = useQuery<MembershipPlan[]>({
    queryKey: ['membership-plans'],
    queryFn: async () => {
      const response = await fetch('/api/membership/plans');
      if (!response.ok) {
        throw new Error('Failed to fetch membership plans');
      }
      return response.json();
    },
  });

  const checkoutMutation = useMutation<CheckoutResponse, Error, void>({
    mutationFn: async () => {
      if (!selectedPriceId) {
        throw new Error('Please select a membership plan');
      }

      const emailForCheckout = (email || checkoutEmail).trim();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const encodedRenewalToken = renewalToken ? encodeURIComponent(renewalToken) : undefined;
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          priceId: selectedPriceId,
          renewalToken,
          email: emailForCheckout,
          successUrl: publicRenewal
            ? `${siteUrl}/renew/complete?${encodedRenewalToken ? `token=${encodedRenewalToken}&` : ''}session_id={CHECKOUT_SESSION_ID}`
            : `${siteUrl}/member?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${siteUrl}/renew?${encodedRenewalToken ? `token=${encodedRenewalToken}&` : ''}canceled=true`,
          coverFees,
          planPrice: selectedPlanPrice,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start renewal');
      }

      return response.json();
    },
    onSuccess: (checkout) => {
      window.location.href = checkout.url;
    },
  });

  const handlePlanSelect = (planId: string, stripePriceId: string) => {
    setSelectedPlanId(planId);
    setSelectedPriceId(stripePriceId);
    setSelectedPlanPrice(plansQuery.data?.find((plan) => plan.id === planId)?.price || 0);
    setValidationError(null);
  };

  useEffect(() => {
    if (!plansQuery.data?.length || selectedPlanId) return;
    const currentPlan = plansQuery.data[0];
    handlePlanSelect(currentPlan.id, currentPlan.stripePriceId);
  }, [plansQuery.data, selectedPlanId]);

  const processingFee = selectedPlanPrice > 0 ? selectedPlanPrice * 0.027 + 0.05 : 0;
  const errorMessage = validationError || checkoutMutation.error?.message || null;
  const needsEmail = !email;
  const emailForCheckout = (email || checkoutEmail).trim();

  const handleSubmit = () => {
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForCheckout)) {
      setValidationError('Please enter a valid email address');
      return;
    }

    if (!selectedPriceId) {
      setValidationError('Please select a membership plan');
      return;
    }
    checkoutMutation.mutate();
  };

  return (
    <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', lg: '1.1fr .9fr'}, gap: 3}}>
      <Box>
        {canceled && (
          <Alert severity="info" sx={{mb: 3}}>
            Your renewal payment was canceled. You can try again below.
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" sx={{mb: 3}}>
            {errorMessage}
          </Alert>
        )}

        {plansQuery.isLoading && (
          <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
            <CircularProgress />
          </Box>
        )}

        {plansQuery.error && (
          <Alert severity="error" sx={{mb: 3}}>
            Failed to load membership plans. Please try again later.
          </Alert>
        )}

        {plansQuery.data && (
          <Grid container spacing={3}>
            {plansQuery.data.map((plan) => (
              <Grid item xs={12} sm={6} key={plan.id}>
                <PlanCard
                  plan={plan}
                  selected={selectedPlanId === plan.id}
                  onSelect={handlePlanSelect}
                  disabled={checkoutMutation.isPending}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Paper className="dec-card" sx={{p: {xs: 3, md: 4}, alignSelf: 'start'}}>
        <Typography variant="h4" component="h2" gutterBottom>
          Renewal
        </Typography>
        <Box sx={{display: 'grid', gap: 1.5, my: 3}}>
          <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
            <Typography color="text.secondary">Account</Typography>
            <Typography fontWeight={700}>{name || email || 'Enter email below'}</Typography>
          </Box>
          {needsEmail && (
            <TextField
              label="Email"
              type="email"
              value={checkoutEmail}
              onChange={(event) => {
                setCheckoutEmail(event.target.value);
                setValidationError(null);
              }}
              disabled={checkoutMutation.isPending}
              fullWidth
              required
            />
          )}
          {expiredOn && (
            <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
              <Typography color="text.secondary">Expired</Typography>
              <Typography fontWeight={700}>{new Date(expiredOn).toLocaleDateString()}</Typography>
            </Box>
          )}
          <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
            <Typography color="text.secondary">Selected plan</Typography>
            <Typography fontWeight={700}>
              {selectedPlanPrice > 0 ? `$${selectedPlanPrice.toFixed(2)}` : '-'}
            </Typography>
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={coverFees}
              onChange={(event) => setCoverFees(event.target.checked)}
              disabled={checkoutMutation.isPending}
            />
          }
          label={`Add ${processingFee > 0 ? `$${processingFee.toFixed(2)}` : 'processing fees'} to help cover card fees`}
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={checkoutMutation.isPending || plansQuery.isLoading}
          sx={{mt: 3}}
        >
          {checkoutMutation.isPending ? 'Starting renewal...' : 'Renew with Stripe'}
        </Button>
      </Paper>
    </Box>
  );
}
