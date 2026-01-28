'use client';

import {
  Container,
  Typography,
  Box,
  Alert,
  Paper,
  Button,
  CircularProgress,
  Stack,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Effect} from 'effect';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';

import {getDigitalCard} from '@/src/lib/effect/client-card';
import type {CardError, NotFoundError, SessionError} from '@/src/lib/effect/errors';
import type {
  MemberDashboardResponse,
  MembershipCard as MembershipCardSchema,
} from '@/src/lib/effect/schemas';

import {DigitalCard} from './DigitalCard';
import {MembershipCard} from './MembershipCard';
import {PortalButton} from './PortalButton';

type MemberDashboardData = MemberDashboardResponse;

interface MemberDashboardClientProps {
  initialData: MemberDashboardData | {error: string};
}

export function MemberDashboardClient({initialData}: MemberDashboardClientProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id') || null;
  const [data, setData] = useState(initialData);
  const [isPolling, setIsPolling] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  // Fetch digital card using Effect + TanStack Query
  // Only enabled when user has an active membership
  const cardQuery = useQuery<
    {hasCard: boolean; card: MembershipCardSchema | null},
    CardError | NotFoundError | SessionError
  >({
    queryKey: ['digitalCard'],
    queryFn: () => Effect.runPromise(getDigitalCard()),
    // Only fetch when membership exists and not in error state
    enabled: !('error' in data) && !!data.membership,
    // Refetch when window regains focus (e.g., returning from Stripe)
    refetchOnWindowFocus: true,
    // Don't retry on 401/404 errors
    retry: (failureCount: number, error: CardError | NotFoundError | SessionError) => {
      if (error._tag === 'SessionError' || error._tag === 'NotFoundError') {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    // If we have a session_id and no membership, poll for it
    const shouldPoll = sessionId && !('error' in data) && !data.membership && pollAttempts < 10;

    if (shouldPoll) {
      setIsPolling(true);

      const pollForMembership = async () => {
        try {
          const response = await fetch('/api/member/dashboard');
          if (response.ok) {
            const freshData = await response.json();

            // Check if response has error (shouldn't be 200 but just in case)
            if ('error' in freshData) {
              console.error('Dashboard error:', freshData.error);
            } else {
              setData(freshData);

              // If membership found, stop polling and refetch card
              if (freshData.membership) {
                setIsPolling(false);
                // Refetch the digital card now that membership exists
                cardQuery.refetch();
              }
            }
          }
        } catch (error) {
          console.error('Error polling for membership:', error);
        }

        setPollAttempts((prev) => prev + 1);
      };

      // Poll every 2 seconds
      const timerId = setTimeout(pollForMembership, 2000);
      return () => clearTimeout(timerId);
    } else if (pollAttempts >= 10) {
      // Stop polling after 10 attempts (20 seconds)
      setIsPolling(false);
    }
  }, [sessionId, data, pollAttempts]);

  if ('error' in data) {
    return (
      <Container maxWidth="md" sx={{py: 4}}>
        <Alert severity="error">{data.error}</Alert>
      </Container>
    );
  }

  const {user, membership, canManageSubscription} = data;

  // Show loading state if polling for membership after checkout
  if (isPolling && sessionId) {
    return (
      <Container maxWidth="md" sx={{py: 4}}>
        <Box sx={{textAlign: 'center'}}>
          <CircularProgress size={60} sx={{mb: 3}} />
          <Typography variant="h5" gutterBottom>
            Setting up your membership...
          </Typography>
          <Typography color="text.secondary">Please wait while we process your payment.</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{py: 4}}>
      {/* Success message after checkout */}
      {sessionId && membership && (
        <Alert severity="success" sx={{mb: 3}}>
          Welcome! Your membership has been activated successfully.
        </Alert>
      )}

      {/* Warning if polling timed out */}
      {sessionId && !membership && pollAttempts >= 10 && (
        <Alert severity="warning" sx={{mb: 3}}>
          Your payment is being processed. If your membership doesn&apos;t appear shortly, please
          refresh the page or contact support.
        </Alert>
      )}

      <Typography variant="h4" component="h1" sx={{mb: 4}}>
        Member Dashboard
      </Typography>

      <Paper sx={{p: 3, mb: 3}}>
        <Typography variant="h6" gutterBottom>
          Welcome, {user.name || user.email}
        </Typography>
        <Typography color="text.secondary">{user.email}</Typography>
      </Paper>

      {membership ? (
        <Box sx={{mb: 3}}>
          {/* Membership Overview */}
          <Stack
            direction="row"
            spacing={2}
            mb={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Membership Overview
            </Typography>
            {/* Portal button */}
            {canManageSubscription && (
              <Box sx={{mt: 3}}>
                <PortalButton
                  returnUrl={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/member`}
                />
              </Box>
            )}
          </Stack>
          <MembershipCard membership={membership} />

          {/* Digital Card Section */}
          <Typography variant="h6" gutterBottom sx={{mt: 4}}>
            Your Digital Membership Card
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
            Show this QR code to verify your membership at events and partner locations.
          </Typography>

          {cardQuery.isLoading ? (
            <DigitalCard card={{} as MembershipCardSchema} loading />
          ) : cardQuery.data?.hasCard && cardQuery.data.card ? (
            <DigitalCard card={cardQuery.data.card} />
          ) : cardQuery.error ? (
            <Paper sx={{p: 3, textAlign: 'center'}}>
              <Typography color="error">{cardQuery.error.message}</Typography>
              <Button variant="text" onClick={() => cardQuery.refetch()} sx={{mt: 1}}>
                Try Again
              </Button>
            </Paper>
          ) : (
            <Paper sx={{p: 3, textAlign: 'center'}}>
              <Typography color="text.secondary">
                Your digital membership card is being generated. This usually takes a few moments
                after checkout.
              </Typography>
              <Button variant="text" onClick={() => cardQuery.refetch()} sx={{mt: 1}}>
                Check Again
              </Button>
            </Paper>
          )}
        </Box>
      ) : (
        <Paper sx={{p: 3, textAlign: 'center'}}>
          <Typography variant="h6" gutterBottom>
            No Active Membership
          </Typography>
          <Typography color="text.secondary" sx={{mb: 2}}>
            You don&apos;t have an active membership yet.
          </Typography>
          <Button component={Link} href="/join" variant="contained" color="primary">
            View Membership Plans
          </Button>
        </Paper>
      )}
    </Container>
  );
}
