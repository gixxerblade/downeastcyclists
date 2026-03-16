'use client';

import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Button,
} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState, Suspense} from 'react';

import {verifyPasswordResetCode, confirmPasswordReset} from '@/src/lib/effect/client-auth';
import type {AuthError} from '@/src/lib/effect/errors';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState<string | null>(null);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [matchError, setMatchError] = useState('');

  const oobCode = searchParams?.get('oobCode') ?? '';

  useEffect(() => {
    if (!oobCode) {
      setCodeValid(false);
      return;
    }

    Effect.runPromise(verifyPasswordResetCode(oobCode))
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setCodeValid(true);
      })
      .catch(() => setCodeValid(false));
  }, [oobCode]);

  const resetMutation = useMutation<void, AuthError, void>({
    mutationFn: () => Effect.runPromise(confirmPasswordReset(oobCode, password)),
    onSuccess: () => router.push('/login?reset=success'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMatchError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setMatchError('Password must be at least 6 characters');
      return;
    }
    setMatchError('');
    resetMutation.mutate();
  };

  if (codeValid === null) {
    return (
      <Container maxWidth="xs">
        <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <CircularProgress />
          <Typography sx={{mt: 2}}>Verifying reset link...</Typography>
        </Box>
      </Container>
    );
  }

  if (!codeValid) {
    return (
      <Container maxWidth="xs">
        <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <Alert severity="error" sx={{width: '100%', mb: 2}}>
            Invalid or expired reset link.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{mb: 2, textAlign: 'center'}}>
            The link may have expired or already been used. Request a new one from the login page.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/login')} fullWidth>
            Back to login
          </Button>
        </Box>
      </Container>
    );
  }

  if (resetMutation.isSuccess) {
    return (
      <Container maxWidth="xs">
        <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <Alert severity="success" sx={{width: '100%', mb: 2}}>
            Password set successfully!
          </Alert>
          <Button variant="contained" onClick={() => router.push('/login')} fullWidth>
            Sign in
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs">
      <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <Typography component="h1" variant="h5" gutterBottom>
          Set your password
        </Typography>
        {email && (
          <Typography color="text.secondary" textAlign="center" sx={{mb: 2}}>
            {email}
          </Typography>
        )}

        {resetMutation.error && (
          <Alert severity="error" sx={{width: '100%', mb: 2}}>
            {resetMutation.error.message}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{width: '100%'}}>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            disabled={resetMutation.isPending}
          />
          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            margin="normal"
            required
            disabled={resetMutation.isPending}
            error={!!matchError}
            helperText={matchError}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{mt: 2}}
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending ? 'Setting password...' : 'Set Password'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="xs">
          <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <CircularProgress />
            <Typography sx={{mt: 2}}>Loading...</Typography>
          </Box>
        </Container>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
