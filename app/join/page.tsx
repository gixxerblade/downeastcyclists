import { Container, Box, Paper, Typography, Alert } from "@mui/material";
import { JoinForm } from "@/src/components/membership/JoinForm";

export const metadata = {
  title: "Join - Down East Cyclists",
  description: "Become a member of Down East Cyclists and enjoy exclusive benefits",
};

interface JoinPageProps {
  searchParams: Promise<{ canceled?: string }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const wasCanceled = params.canceled === "true";

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Join Down East Cyclists
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Become a member and enjoy exclusive benefits, discounts, and access to club events.
        </Typography>
      </Box>

      {wasCanceled && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Your payment was canceled. You can try again below or contact us if you need assistance.
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 } }}>
        <JoinForm />
      </Paper>
    </Container>
  );
}
