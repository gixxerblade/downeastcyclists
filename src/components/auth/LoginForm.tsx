'use client';

import {Box, Button, TextField, Typography, Alert, Divider} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, useEffect} from 'react';

import {loginWithPassword, sendMagicLink} from '@/src/lib/effect/client-auth';
import type {AuthError} from '@/src/lib/effect/errors';

interface LoginCredentials {
  email: string;
  password: string;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Check if user is already logged in and redirect
  useEffect(() => {
    const checkAuth = async () => {
      const hasSession = document.cookie.includes('session=');
      if (hasSession) {
        // Check session validity via server
        try {
          const response = await fetch('/api/auth/session', {method: 'GET'});
          if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
              const adminEmail = (
                process.env.NEXT_PUBLIC_ALLOWED_EMAIL || 'info@downeastcyclists.com'
              )
                .toLowerCase()
                .trim();
              const userEmail = (data.email || '').toLowerCase().trim();
              const isAdmin = userEmail === adminEmail;

              window.location.href = isAdmin ? '/dashboard' : '/member';
            }
          }
        } catch (error) {
          // Silently fail - user can login normally
          console.error('Auth check error:', error);
        }
      }
    };

    checkAuth();
  }, [router]);

  // Email/Password Login Mutation - using Effect
  const loginMutation = useMutation<unknown, AuthError, LoginCredentials>({
    mutationFn: (credentials) => Effect.runPromise(loginWithPassword(credentials)),
    onSuccess: (_, variables) => {
      console.log('Login successful, redirecting...', variables.email);
      // Check if user is admin - normalize email comparison
      const adminEmail = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL || 'info@downeastcyclists.com')
        .toLowerCase()
        .trim();
      const userEmail = variables.email.toLowerCase().trim();
      const isAdmin = userEmail === adminEmail;

      console.log('Admin check:', {adminEmail, userEmail, isAdmin});

      // Use window.location for a hard redirect to ensure it works
      const redirectUrl = isAdmin ? '/dashboard' : '/member';
      console.log('Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
    },
    onError: (error) => {
      console.error('Login error:', error);
    },
  });

  // Magic Link Mutation - using Effect
  const magicLinkMutation = useMutation<void, AuthError, string>({
    mutationFn: (email) =>
      Effect.runPromise(sendMagicLink(email, `${window.location.origin}/member/verify`)),
    onSuccess: () => {
      setMagicLinkSent(true);
    },
  });

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({email, password});
  };

  const handleMagicLink = () => {
    if (!email) {
      loginMutation.reset();
      magicLinkMutation.reset();
      return;
    }
    magicLinkMutation.mutate(email);
  };

  const isLoading = loginMutation.isPending || magicLinkMutation.isPending;
  const error = loginMutation.error || magicLinkMutation.error;

  if (magicLinkSent) {
    return (
      <Box textAlign="center">
        <Typography variant="h6" gutterBottom>
          Check your email
        </Typography>
        <Typography color="text.secondary">We sent a sign-in link to {email}</Typography>
      </Box>
    );
  }

  // Helper to extract error message from AuthError
  const getErrorMessage = (error: AuthError | null): string | null => {
    if (!error) return null;
    return error.message;
  };

  return (
    <Box component="form" onSubmit={handleEmailPasswordLogin}>
      {error && (
        <Alert severity="error" sx={{mb: 2}}>
          {getErrorMessage(error)}
        </Alert>
      )}

      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="normal"
      />

      <Button type="submit" fullWidth variant="contained" disabled={isLoading} sx={{mt: 2}}>
        {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
      </Button>

      <Divider sx={{my: 3}}>or</Divider>

      <Button fullWidth variant="outlined" onClick={handleMagicLink} disabled={isLoading || !email}>
        {magicLinkMutation.isPending ? 'Sending...' : 'Send Magic Link'}
      </Button>

      <Box sx={{mt: 2, textAlign: 'center'}}>
        <Typography variant="body2" color="text.secondary">
          Don&apos;t have an account?{' '}
          <Link href="/join" style={{color: '#F20E02', textDecoration: 'none'}}>
            Join Now
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
