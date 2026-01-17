"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container, Box, Paper, Typography, CircularProgress, Alert, Button } from "@mui/material";
import { CheckCircle } from "@mui/icons-material";

interface PostCheckoutLoaderProps {
  sessionId: string;
}

export function PostCheckoutLoader({ sessionId }: PostCheckoutLoaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "timeout">("loading");
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 30; // 30 seconds max (polling every 1 second)

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let timeoutTimer: NodeJS.Timeout;

    const checkMembershipReady = async () => {
      try {
        const response = await fetch("/api/member/check-session");

        if (response.ok) {
          const data = await response.json();

          if (data.ready && data.hasMembership) {
            setStatus("ready");

            // Wait a moment to show success, then redirect
            setTimeout(() => {
              // Remove session_id from URL and reload the page
              const newUrl = window.location.pathname;
              router.replace(newUrl);
              router.refresh();
            }, 1500);

            clearInterval(pollInterval);
            clearTimeout(timeoutTimer);
            return;
          }
        }

        // Increment attempts
        setAttempts((prev) => {
          const newAttempts = prev + 1;

          if (newAttempts >= maxAttempts) {
            setStatus("timeout");
            clearInterval(pollInterval);
            clearTimeout(timeoutTimer);
          }

          return newAttempts;
        });
      } catch (error) {
        console.error("Error checking membership status:", error);
        setAttempts((prev) => prev + 1);
      }
    };

    // Start polling immediately
    checkMembershipReady();

    // Then poll every second
    pollInterval = setInterval(checkMembershipReady, 1000);

    // Set overall timeout
    timeoutTimer = setTimeout(() => {
      if (status === "loading") {
        setStatus("timeout");
        clearInterval(pollInterval);
      }
    }, maxAttempts * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeoutTimer);
    };
  }, [sessionId, router, status]);

  const handleManualRefresh = () => {
    const newUrl = window.location.pathname;
    router.replace(newUrl);
    router.refresh();
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: "center" }}>
          {status === "loading" && (
            <>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                Processing Your Membership
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                We&apos;re setting up your account. This usually takes just a few seconds...
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Attempt {attempts} of {maxAttempts}
              </Typography>
            </>
          )}

          {status === "ready" && (
            <>
              <CheckCircle sx={{ fontSize: 60, color: "success.main", mb: 2 }} />
              <Typography variant="h5" gutterBottom color="success.main">
                Membership Activated!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Redirecting you to your dashboard...
              </Typography>
            </>
          )}

          {status === "timeout" && (
            <>
              <Alert severity="warning" sx={{ mb: 3, textAlign: "left" }}>
                <Typography variant="subtitle1" gutterBottom>
                  Taking longer than expected
                </Typography>
                <Typography variant="body2">
                  Your payment was successful, but we&apos;re still processing your membership. This
                  can take up to a minute. You can wait or try refreshing the page.
                </Typography>
              </Alert>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                <Button variant="contained" onClick={handleManualRefresh}>
                  Refresh Now
                </Button>
                <Button variant="outlined" href="mailto:support@downeastcyclists.org">
                  Contact Support
                </Button>
              </Box>
            </>
          )}

          {status === "error" && (
            <>
              <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
                <Typography variant="subtitle1" gutterBottom>
                  Unable to verify membership
                </Typography>
                <Typography variant="body2">
                  There was an issue checking your membership status. Your payment may still have
                  been successful. Please try refreshing the page or contact support.
                </Typography>
              </Alert>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                <Button variant="contained" onClick={handleManualRefresh}>
                  Try Again
                </Button>
                <Button variant="outlined" href="mailto:support@downeastcyclists.org">
                  Contact Support
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
