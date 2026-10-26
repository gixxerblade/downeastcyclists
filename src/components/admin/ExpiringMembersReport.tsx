'use client';

import {Download} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {getExpiringMemberships} from '@/src/lib/effect/client-admin';
import type {ExpiringMember} from '@/src/types/admin';

interface ExpiringMembersReportProps {
  open: boolean;
  onClose: () => void;
}

export function ExpiringMembersReport({open, onClose}: ExpiringMembersReportProps) {
  const [renewalFilter, setRenewalFilter] = useState<'manual' | 'automatic'>('manual');
  const [daysFilter, setDaysFilter] = useState<30 | 60 | 90>(30);

  const expiringQuery = useQuery({
    queryKey: ['admin', 'expiring', daysFilter],
    queryFn: () => Effect.runPromise(getExpiringMemberships(daysFilter)),
    enabled: open,
  });

  const visibleMembers = expiringQuery.data?.filter(
    (member) => member.autoRenew === (renewalFilter === 'automatic'),
  );
  const automatic = renewalFilter === 'automatic';

  const handleExportCSV = () => {
    if (!visibleMembers || visibleMembers.length === 0) return;

    const headers = [
      'Email',
      'Name',
      'Phone',
      'Plan Type',
      'Status',
      'Membership #',
      'Renewal Type',
      automatic ? 'Renewal Date' : 'Expiration Date',
      automatic ? 'Days Until Renewal' : 'Days Until Expiration',
    ];
    const rows = visibleMembers.map((m: ExpiringMember) => [
      m.email,
      m.name || '',
      m.phone || '',
      m.planType,
      m.status,
      m.membershipNumber || '',
      m.autoRenew ? 'Renews automatically' : 'Needs renewal',
      new Date(m.expirationDate).toLocaleDateString(),
      m.daysUntilExpiration.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], {type: 'text/csv'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memberships-${renewalFilter}-${daysFilter}days-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Membership Renewals Report</DialogTitle>
      <DialogContent>
        <Box sx={{pt: 1}}>
          <Tabs
            value={renewalFilter}
            onChange={(_, value) => setRenewalFilter(value)}
            aria-label="Renewal type"
          >
            <Tab label="Needs renewal" value="manual" />
            <Tab label="Renews automatically" value="automatic" />
          </Tabs>
          <Alert severity="info" sx={{my: 2}}>
            {automatic
              ? 'These memberships renew automatically. Members receive a 30-day notice that their card will be charged; no manual renewal is needed.'
              : 'These memberships need manual renewal. Members who already renewed are excluded. Automatic renewals are listed separately.'}
          </Alert>
          <Box sx={{borderBottom: 1, borderColor: 'divider', mb: 2}}>
            <Tabs value={daysFilter} onChange={(_, v) => setDaysFilter(v)}>
              <Tab label="Next 30 Days" value={30} />
              <Tab label="Next 60 Days" value={60} />
              <Tab label="Next 90 Days" value={90} />
            </Tabs>
          </Box>

          {expiringQuery.isLoading && (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
              <CircularProgress />
            </Box>
          )}

          {expiringQuery.error && (
            <Alert severity="error">
              {expiringQuery.error.message || 'Failed to load expiring memberships'}
            </Alert>
          )}

          {visibleMembers && visibleMembers.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{py: 4}}>
              No memberships {automatic ? 'renewing automatically' : 'needing renewal'} in the next{' '}
              {daysFilter} days
            </Typography>
          )}

          {visibleMembers && visibleMembers.length > 0 && (
            <>
              <Box
                sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}
              >
                <Typography variant="subtitle2">
                  {visibleMembers.length} memberships{' '}
                  {automatic ? 'renewing automatically' : 'needing renewal'}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download />}
                  onClick={handleExportCSV}
                >
                  Export CSV
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{maxHeight: 500}}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Membership #</TableCell>
                      <TableCell>{automatic ? 'Renews on' : 'Expires'}</TableCell>
                      <TableCell>Days Left</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleMembers.map((member: ExpiringMember) => (
                      <TableRow key={member.userId}>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{member.name || '-'}</TableCell>
                        <TableCell>{member.phone || '-'}</TableCell>
                        <TableCell>
                          {member.planType === 'family' ? 'Family' : 'Individual'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={member.status}
                            color={member.status === 'active' ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell sx={{fontFamily: 'monospace'}}>
                          {member.membershipNumber || '-'}
                        </TableCell>
                        <TableCell>
                          {new Date(member.expirationDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={`${member.daysUntilExpiration} days`}
                            color={
                              !automatic && member.daysUntilExpiration <= 7
                                ? 'error'
                                : !automatic && member.daysUntilExpiration <= 14
                                  ? 'warning'
                                  : 'default'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
