"use client";

import { Container, Box, Paper, CircularProgress } from "@mui/material";
import { LoginForm } from "@/src/components/auth/LoginForm";
import { Suspense } from "react";

function LoginLoading() {
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
        <CircularProgress />
      </Box>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          marginBottom: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: "100%" }}>
          <Suspense fallback={<LoginLoading />}>
            <LoginForm />
          </Suspense>
        </Paper>
      </Box>
    </Container>
  );
}
