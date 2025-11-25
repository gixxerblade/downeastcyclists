"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  TextField,
  Box,
  Typography,
  Container,
  Alert,
  CircularProgress,
} from "@mui/material";
import { signInWithEmail } from "@/src/utils/firebase";
import { FirebaseError } from "firebase/app";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check for redirect cookie on component mount
  useEffect(() => {
    // If we were redirected here from middleware, clear browser history
    const hasRedirectCookie = document.cookie.includes("auth-redirect=true");
    if (hasRedirectCookie) {
      // Clear the redirect cookie
      document.cookie = "auth-redirect=; path=/; max-age=0";

      // Replace the current history entry to prevent back navigation
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Sign in with Firebase
      const user = await signInWithEmail(email, password);

      // Get the ID token
      const idToken = await user.getIdToken();

      // Set a cookie with the Firebase ID token
      document.cookie = `auth-token=${idToken}; path=/; max-age=${60 * 60 * 24 * 7}`; // 1 week

      // Redirect to dashboard, replacing history so there's no back button
      router.replace("/dashboard");
      router.refresh(); // Refresh to ensure middleware picks up the new cookie
    } catch (err) {
      console.error("Login error:", err);

      if (err instanceof FirebaseError) {
        // Handle Firebase-specific errors
        switch (err.code) {
          case "auth/invalid-email":
            setError("Invalid email address format");
            break;
          case "auth/user-not-found":
          case "auth/wrong-password":
            setError("Invalid email or password");
            break;
          case "auth/too-many-requests":
            setError("Too many failed login attempts. Please try again later");
            break;
          default:
            setError(`Authentication error: ${err.message}`);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h5">
          Admin Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%", mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            sx={{ mt: 3, mb: 2 }}
          >
            {isLoading ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
