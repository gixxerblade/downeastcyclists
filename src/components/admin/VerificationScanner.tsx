'use client';

import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Button,
  TextField,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {useState} from 'react';

import type {VerificationResult} from '@/src/lib/effect/schemas';

interface VerificationScannerProps {
  onVerificationResult?: (result: VerificationResult) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{pt: 2}}>{children}</Box>}
    </div>
  );
}

export function VerificationScanner({onVerificationResult}: VerificationScannerProps) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [membershipNumber, setMembershipNumber] = useState('');
  const [qrData, setQrData] = useState('');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const verifyByMembershipNumber = async () => {
    if (!membershipNumber.trim()) {
      setError('Please enter a membership number');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/admin/verify/${encodeURIComponent(membershipNumber.trim())}`,
      );
      const verificationResult = await response.json();

      if (verificationResult.error) {
        setError(verificationResult.error);
      } else {
        setResult(verificationResult);
        onVerificationResult?.(verificationResult);
      }
    } catch {
      setError('Failed to verify membership');
    } finally {
      setLoading(false);
    }
  };

  const verifyByQRData = async () => {
    if (!qrData.trim()) {
      setError('Please paste QR code data');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/verify/qr', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({qrData: qrData.trim()}),
      });
      const verificationResult = await response.json();

      if (verificationResult.error) {
        setError(verificationResult.error);
      } else {
        setResult(verificationResult);
        onVerificationResult?.(verificationResult);
      }
    } catch {
      setError('Failed to verify membership');
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = () => {
    setResult(null);
    setError(null);
    setMembershipNumber('');
    setQrData('');
  };

  if (result) {
    return (
      <Card>
        <CardContent>
          <Alert severity={result.valid ? 'success' : 'error'} sx={{mb: 2}}>
            {result.message}
          </Alert>

          <Typography variant="h6" gutterBottom>
            {result.memberName}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Membership #{result.membershipNumber}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {result.planType === 'family' ? 'Family' : 'Individual'} Plan
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Status: {result.status}
          </Typography>

          {result.expiresAt && (
            <Typography variant="body2" color="text.secondary">
              Expires: {new Date(result.expiresAt).toLocaleDateString()}
            </Typography>
          )}

          {result.daysRemaining > 0 && (
            <Typography variant="body2" color="text.secondary">
              {result.daysRemaining} days remaining
            </Typography>
          )}

          <Button variant="outlined" fullWidth onClick={handleRescan} sx={{mt: 2}}>
            Verify Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Verify Membership
        </Typography>

        {error && (
          <Alert severity="error" sx={{mb: 2}}>
            {error}
          </Alert>
        )}

        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="By Number" />
            <Tab label="By QR Data" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <TextField
            fullWidth
            label="Membership Number"
            placeholder="DEC-2025-000001"
            value={membershipNumber}
            onChange={(e) => setMembershipNumber(e.target.value)}
            disabled={loading}
            sx={{mb: 2}}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={verifyByMembershipNumber}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Verify'}
          </Button>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TextField
            fullWidth
            label="QR Code Data"
            placeholder="Paste scanned QR data (JSON format)"
            value={qrData}
            onChange={(e) => setQrData(e.target.value)}
            disabled={loading}
            multiline
            rows={3}
            sx={{mb: 2}}
          />
          <Button variant="contained" fullWidth onClick={verifyByQRData} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Verify QR'}
          </Button>
        </TabPanel>

        <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
          Enter membership number or paste QR code data to verify membership status
        </Typography>
      </CardContent>
    </Card>
  );
}
