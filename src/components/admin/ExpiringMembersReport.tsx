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
  const [daysFilter, setDaysFilter] = useState<30 | 60 | 90>(30);

  const expiringQuery = useQuery({
    queryKey: ['admin', 'expiring', daysFilter],
    queryFn: () => Effect.runPromise(getExpiringMemberships(daysFilter)),
    enabled: open,
  });

  const handleExportCSV = () => {
    if (!expiringQuery.data || expiringQuery.data.length === 0) return;

    const headers = [
      'Email',
      'Name',
      'Phone',
      'Plan Type',
      'Status',
      'Membership #',
      'Expiration Date',
      'Days Until Expiration',
    ];
    const rows = expiringQuery.data.map((m: ExpiringMember) => [
      m.email,
      m.name || '',
      m.phone || '',
      m.planType,
      m.status,
      m.membershipNumber || '',
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
    a.download = `expiring-memberships-${daysFilter}days-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Expiring Memberships Report</DialogTitle>
      <DialogContent>
        <Box sx={{pt: 1}}>
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

          {expiringQuery.data && expiringQuery.data.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{py: 4}}>
              No memberships expiring in the next {daysFilter} days
            </Typography>
          )}

          {expiringQuery.data && expiringQuery.data.length > 0 && (
            <>
              <Box
                sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}
              >
                <Typography variant="subtitle2">
                  {expiringQuery.data.length} memberships expiring
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
                      <TableCell>Expires</TableCell>
                      <TableCell>Days Left</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expiringQuery.data.map((member: ExpiringMember) => (
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
                              member.daysUntilExpiration <= 7
                                ? 'error'
                                : member.daysUntilExpiration <= 14
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
