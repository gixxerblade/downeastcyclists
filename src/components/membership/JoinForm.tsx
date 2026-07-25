'use client';

import {Visibility, VisibilityOff} from '@mui/icons-material';
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {useQuery, useMutation} from '@tanstack/react-query';
import {Schema as S} from 'effect';
import {Effect} from 'effect';
import Link from 'next/link';
import {useEffect, useState} from 'react';

import {joinAndCheckout, type JoinRequest} from '@/src/lib/effect/client-join';
import type {AuthError} from '@/src/lib/effect/errors';
import {JoinFormData} from '@/src/lib/effect/schemas';

import {PlanCard, type MembershipPlan} from './PlanCard';

export function JoinForm() {
  // Form state
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number>(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [coverFees, setCoverFees] = useState(false);

  // Check if passwords match (for real-time feedback)
  const passwordsMatch = password === confirmPassword;
  const showPasswordMatchError = confirmPassword.length > 0 && !passwordsMatch;

  // Calculate processing fee: 2.7% + $0.05
  const processingFee = selectedPlanPrice > 0 ? selectedPlanPrice * 0.027 + 0.05 : 0;

  // Fetch plans
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

  // Join mutation
  const joinMutation = useMutation<{checkoutUrl: string}, AuthError, JoinRequest>({
    mutationFn: (request) => Effect.runPromise(joinAndCheckout(request)),
    onSuccess: (result) => {
      // Redirect to Stripe checkout
      window.location.href = result.checkoutUrl;
    },
  });

  const handlePlanSelect = (planId: string, stripePriceId: string) => {
    setSelectedPlanId(planId);
    setSelectedPriceId(stripePriceId);

    // Find and store the price for fee calculation
    const plan = plansQuery.data?.find((p) => p.id === planId);
    if (plan) {
      setSelectedPlanPrice(plan.price);
    }

    setValidationError(null);
  };

  useEffect(() => {
    if (!plansQuery.data?.length || selectedPlanId) return;
    const familyPlan =
      plansQuery.data.find((plan) => plan.name.toLowerCase().includes('family')) ||
      plansQuery.data[0];
    handlePlanSelect(familyPlan.id, familyPlan.stripePriceId);
  }, [plansQuery.data, selectedPlanId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate form data using Effect Schema
    const formData = {
      email,
      password,
      confirmPassword,
      name: name || undefined,
      selectedPlanId: selectedPlanId || '',
      selectedPriceId: selectedPriceId || '',
    };

    const parseResult = S.decodeUnknownEither(JoinFormData)(formData);

    if (parseResult._tag === 'Left') {
      // Extract first validation error message
      const error = parseResult.left;
      const message = error.message || 'Please check your form inputs';
      setValidationError(message);
      return;
    }

    // Validate passwords match (custom validation after schema)
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    // Get site URL for redirects
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    // Validate that a plan is selected
    if (!selectedPriceId) {
      setValidationError('Please select a membership plan');
      return;
    }

    // Submit join request
    joinMutation.mutate({
      email,
      password,
      name: name || undefined,
      priceId: selectedPriceId,
      successUrl: `${siteUrl}/member?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/join?canceled=true`,
      coverFees,
      planPrice: selectedPlanPrice,
    });
  };

  // Determine error message
  const errorMessage = validationError || (joinMutation.error?.message ?? null);
  const isEmailInUse = joinMutation.error?.code === 'EMAIL_IN_USE';
  const selectedPlan = plansQuery.data?.find((plan) => plan.id === selectedPlanId) || null;
  const summaryPrice = selectedPlan?.price || selectedPlanPrice || 0;

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {/* Error Alert */}
      {errorMessage && (
        <Alert
          severity="error"
          sx={{mb: 3}}
          action={
            isEmailInUse ? (
              <Button color="inherit" size="small" component={Link} href="/login">
                Sign In
              </Button>
            ) : undefined
          }
        >
          {errorMessage}
          {isEmailInUse && ' Already have an account?'}
        </Alert>
      )}

      {/* Step 1: Select Plan */}
      {plansQuery.isLoading && (
        <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
          <CircularProgress />
        </Box>
      )}

      {plansQuery.error && (
        <Alert severity="error" sx={{mb: 2}}>
          Failed to load membership plans. Please try again later.
        </Alert>
      )}

      {plansQuery.data && (
        <Grid container spacing={3} sx={{mb: 4}}>
          {plansQuery.data.map((plan) => (
            <Grid item xs={12} sm={6} key={plan.id}>
              <PlanCard
                plan={plan}
                selected={selectedPlanId === plan.id}
                onSelect={handlePlanSelect}
                disabled={joinMutation.isPending}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {xs: '1fr', md: '1.3fr .7fr'},
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box className="dec-card" sx={{p: {xs: 3, md: 4}}}>
          <Typography variant="h4" component="h2" gutterBottom>
            Your details
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
            Your account lets you manage your membership and access member benefits.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name (Optional)"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={joinMutation.isPending}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={joinMutation.isPending}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={joinMutation.isPending}
                helperText="Minimum 6 characters"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        disabled={joinMutation.isPending}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={joinMutation.isPending}
                error={showPasswordMatchError}
                helperText={showPasswordMatchError ? 'Passwords do not match' : ' '}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        disabled={joinMutation.isPending}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>

          {/* Processing Fee Option */}
          {selectedPlanId && processingFee > 0 && (
            <Box sx={{mt: 3}}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={coverFees}
                    onChange={(e) => setCoverFees(e.target.checked)}
                    disabled={joinMutation.isPending}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    Help cover credit card processing fees (+${processingFee.toFixed(2)})
                    <Typography variant="caption" display="block" color="text.secondary">
                      Optional - 100% of your membership goes directly to the club
                    </Typography>
                  </Typography>
                }
              />
            </Box>
          )}
        </Box>

        <Box className="dec-card" sx={{p: {xs: 3, md: 4}, position: {md: 'sticky'}, top: 96}}>
          <Typography variant="h4" component="h2" gutterBottom>
            Summary
          </Typography>
          <Box sx={{display: 'flex', justifyContent: 'space-between', py: 1.5}}>
            <Typography color="text.secondary">{selectedPlan?.name || 'Membership'}</Typography>
            <Typography fontWeight={700}>${summaryPrice.toFixed(2)}</Typography>
          </Box>
          {coverFees && (
            <Box sx={{display: 'flex', justifyContent: 'space-between', py: 1.5}}>
              <Typography color="text.secondary">Processing fees</Typography>
              <Typography fontWeight={700}>${processingFee.toFixed(2)}</Typography>
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--dec-border)',
              mt: 1.5,
              pt: 2,
              mb: 3,
            }}
          >
            <Typography fontWeight={800}>Total</Typography>
            <Typography fontWeight={800}>
              ${(summaryPrice + (coverFees ? processingFee : 0)).toFixed(2)}
            </Typography>
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={joinMutation.isPending || !selectedPlanId}
            sx={{bgcolor: '#F20E02', '&:hover': {bgcolor: '#b30a01'}}}
          >
            {joinMutation.isPending ? (
              <>
                <CircularProgress size={20} sx={{mr: 1}} color="inherit" />
                Processing...
              </>
            ) : (
              'Continue to secure checkout →'
            )}
          </Button>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{mt: 2, display: 'block', textAlign: 'center'}}
          >
            🔒 Secure checkout by Stripe · Auto-renews at ${summaryPrice || 0}/yr · Cancel anytime
          </Typography>
        </Box>
      </Box>

      {/* Already a member link */}
      <Box sx={{textAlign: 'center', mt: 4}}>
        <Typography variant="body2" color="text.secondary">
          Already a member?{' '}
          <Link href="/login" style={{color: '#F20E02', textDecoration: 'none'}}>
            Sign In
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
