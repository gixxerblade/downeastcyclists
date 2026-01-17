'use client';

import {Button, CircularProgress, Alert} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useRouter} from 'next/navigation';

import {createPortalSession} from '@/src/lib/effect/client-portal';
import type {StripeError, NotFoundError} from '@/src/lib/effect/errors';

interface PortalButtonProps {
  returnUrl: string;
  disabled?: boolean;
}

export function PortalButton({returnUrl, disabled}: PortalButtonProps) {
  const router = useRouter();

  // Using Effect with TanStack Query for consistent error handling
  const portalMutation = useMutation<{url: string}, StripeError | NotFoundError, void>({
    mutationFn: () => Effect.runPromise(createPortalSession(returnUrl)),
    onSuccess: (data) => {
      // Redirect to Stripe portal
      router.push(data.url);
    },
  });

  return (
    <>
      {portalMutation.error && (
        <Alert severity="error" sx={{mb: 2}}>
          {portalMutation.error.message}
        </Alert>
      )}
      <Button
        variant="outlined"
        onClick={() => portalMutation.mutate()}
        disabled={portalMutation.isPending || disabled}
        startIcon={portalMutation.isPending ? <CircularProgress size={20} /> : null}
      >
        {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
      </Button>
    </>
  );
}
