'use client';

import {Container, Box, Paper, CircularProgress, Typography} from '@mui/material';
import {Suspense} from 'react';

import {LoginForm} from '@/src/components/auth/LoginForm';

function LoginLoading() {
  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <main className="dec-page">
      <Box className="dec-container" sx={{py: {xs: 6, md: 10}, display: 'grid', placeItems: 'center'}}>
        <Paper className="dec-card" elevation={0} sx={{p: {xs: 3, md: 4}, width: '100%', maxWidth: 460}}>
          <Typography variant="overline" sx={{color: '#F20E02', fontWeight: 800, letterSpacing: '.1em'}}>
            MEMBER ACCESS
          </Typography>
          <Typography variant="h1" sx={{fontSize: {xs: 48, md: 64}, mb: 2}}>
            Log in
          </Typography>
          <Suspense fallback={<LoginLoading />}>
            <LoginForm />
          </Suspense>
        </Paper>
      </Box>
    </main>
  );
}
