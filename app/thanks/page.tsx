import React from 'react';
import { Container, Typography, Button } from '@mui/material';
import Link from 'next/link';

export default function Thanks() {
  return (
    <Container maxWidth="md" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="text-center">
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Thank You!
        </Typography>
        
        <Typography variant="body1" paragraph>
          Your message has been received. We'll get back to you as soon as possible.
        </Typography>
        
        <div className="mt-8">
          <Link href="/" passHref>
            <Button variant="contained" color="primary">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
