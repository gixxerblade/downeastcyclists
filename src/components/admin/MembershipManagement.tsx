'use client';

import {Refresh, Add, Upload, Schedule} from '@mui/icons-material';
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {useDebouncedCallback} from '@tanstack/react-pacer';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {refreshStats, getStats, getMembers} from '@/src/lib/effect/client-admin';
import type {DatabaseError, UnauthorizedError} from '@/src/lib/effect/errors';
import type {MembershipStats, MemberWithMembership} from '@/src/lib/effect/schemas';

import {BulkImportModal} from './BulkImportModal';
import {CreateMemberModal} from './CreateMemberModal';
import {DeleteMemberDialog} from './DeleteMemberDialog';
import {EditMemberModal} from './EditMemberModal';
import {ExpiringMembersReport} from './ExpiringMembersReport';
import {MemberAuditLog} from './MemberAuditLog';
import {MemberTable} from './MemberTable';
import {PaymentHistoryPanel} from './PaymentHistoryPanel';
import {StatsCards} from './StatsCards';

export function MembershipManagement() {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState(''); // For input display
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(''); // For actual query
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [planTypeFilter, setPlanTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [expiringReportOpen, setExpiringReportOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithMembership | null>(null);
  const [deletingMember, setDeletingMember] = useState<MemberWithMembership | null>(null);
  const [auditMember, setAuditMember] = useState<MemberWithMembership | null>(null);
  const [paymentHistoryMember, setPaymentHistoryMember] = useState<MemberWithMembership | null>(
    null,
  );

  // Debounce search input using TanStack Pacer React hook
  const debouncedSetSearch = useDebouncedCallback(
    (value: string) => setDebouncedSearchQuery(value),
    {
      wait: 300, // Wait 300ms after last keystroke
    },
  );

  // Query for stats (cached)
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => Effect.runPromise(getStats()),
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });

  // Query for members (cached and debounced via TanStack Pacer)
  const membersQuery = useQuery({
    queryKey: [
      'admin',
      'members',
      page,
      pageSize,
      debouncedSearchQuery,
      statusFilter,
      planTypeFilter,
    ],
    queryFn: () =>
      Effect.runPromise(
        getMembers({
          page,
          pageSize,
          query: debouncedSearchQuery || undefined,
          status: statusFilter || undefined,
          planType: planTypeFilter || undefined,
        }),
      ),
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
  });

  // TanStack Query mutation for refreshing stats (following Effect-TS architecture)
  const refreshStatsMutation = useMutation<
    MembershipStats,
    DatabaseError | UnauthorizedError,
    void
  >({
    mutationFn: () => Effect.runPromise(refreshStats()),
    onSuccess: () => {
      // Invalidate both queries to refetch with fresh data
      queryClient.invalidateQueries({queryKey: ['admin', 'stats']});
      queryClient.invalidateQueries({queryKey: ['admin', 'members']});
    },
  });

  // Export members
  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const response = await fetch('/api/admin/export', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          includeEmail: true,
          includePhone: true,
          includeAddress: true,
          statusFilter: statusFilter || undefined,
          format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `members-export-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 3}}>
      {/* Stats Section */}
      <Box>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
          <Typography variant="h5" component="h2">
            Membership Statistics
          </Typography>
          <Button
            variant="contained"
            onClick={() => refreshStatsMutation.mutate()}
            disabled={refreshStatsMutation.isPending}
            startIcon={<Refresh />}
          >
            {refreshStatsMutation.isPending ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
        </Box>
        {/* Error display for stats refresh */}
        {refreshStatsMutation.error && (
          <Alert severity="error" sx={{mb: 2}}>
            {refreshStatsMutation.error.message}
          </Alert>
        )}
        <StatsCards stats={statsQuery.data ?? null} loading={statsQuery.isLoading} />
      </Box>

      {/* Members Section */}
      <Box>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
          <Typography variant="h5" component="h2">
            Members
          </Typography>
          <Box sx={{display: 'flex', gap: 1}}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setCreateModalOpen(true)}
              startIcon={<Add />}
            >
              Create Member
            </Button>
            <Button
              variant="outlined"
              onClick={() => setBulkImportModalOpen(true)}
              startIcon={<Upload />}
            >
              Bulk Import
            </Button>
            <Button
              variant="outlined"
              onClick={() => setExpiringReportOpen(true)}
              startIcon={<Schedule />}
            >
              Expiring Report
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => handleExport('json')}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export JSON'}
            </Button>
          </Box>
        </Box>

        {/* Search and Filters */}
        <Paper sx={{p: 3, mb: 2}}>
          <Grid container spacing={2}>
            <Grid size={{xs: 12, md: 3}}>
              <TextField
                fullWidth
                label="Search"
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value); // Update input immediately
                  debouncedSetSearch(value); // Debounced query update
                  setPage(1);
                }}
                placeholder="Name, email, or membership #"
                size="small"
              />
            </Grid>

            <Grid size={{xs: 12, md: 3}}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="past_due">Past Due</MenuItem>
                  <MenuItem value="canceled">Canceled</MenuItem>
                  <MenuItem value="incomplete">Incomplete</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                  <MenuItem value="deleted">Deleted</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{xs: 12, md: 3}}>
              <FormControl fullWidth size="small">
                <InputLabel>Plan Type</InputLabel>
                <Select
                  value={planTypeFilter}
                  label="Plan Type"
                  onChange={(e) => {
                    setPlanTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">All Plans</MenuItem>
                  <MenuItem value="individual">Individual</MenuItem>
                  <MenuItem value="family">Family</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid
              component="div"
              size={{xs: 12, md: 3}}
              sx={{display: 'flex', alignItems: 'center'}}
            >
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearchQuery('');
                  setStatusFilter('');
                  setPlanTypeFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Member Table */}
        {membersQuery.isLoading ? (
          <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
            <Typography color="text.secondary">Loading members...</Typography>
          </Box>
        ) : membersQuery.error ? (
          <Alert severity="error">{membersQuery.error.message || 'Failed to load members'}</Alert>
        ) : (
          <MemberTable
            members={membersQuery.data?.members || []}
            total={membersQuery.data?.total || 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            onEditMember={(member) => setEditingMember(member)}
            onDeleteMember={(member) => setDeletingMember(member)}
            onViewAudit={(member) => setAuditMember(member)}
            onViewPayments={(member) => setPaymentHistoryMember(member)}
          />
        )}
      </Box>

      {/* Modals */}
      <CreateMemberModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />

      <BulkImportModal open={bulkImportModalOpen} onClose={() => setBulkImportModalOpen(false)} />

      <ExpiringMembersReport
        open={expiringReportOpen}
        onClose={() => setExpiringReportOpen(false)}
      />

      <EditMemberModal
        open={!!editingMember}
        member={editingMember}
        onClose={() => setEditingMember(null)}
      />

      <DeleteMemberDialog
        open={!!deletingMember}
        member={deletingMember}
        onClose={() => setDeletingMember(null)}
      />

      <MemberAuditLog
        open={!!auditMember}
        userId={auditMember?.user?.id || null}
        memberName={auditMember?.user?.name || auditMember?.user?.email}
        onClose={() => setAuditMember(null)}
      />

      <PaymentHistoryPanel
        open={!!paymentHistoryMember}
        userId={paymentHistoryMember?.user?.id || null}
        memberName={paymentHistoryMember?.user?.name || paymentHistoryMember?.user?.email}
        onClose={() => setPaymentHistoryMember(null)}
      />
    </Box>
  );
}
