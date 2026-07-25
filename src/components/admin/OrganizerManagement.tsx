'use client';

import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState} from 'react';

import {hasCurrentMembership} from '@/src/lib/access-control';
import {getMembers, type GetMembersResponse} from '@/src/lib/effect/client-admin';
import type {MemberWithMembership} from '@/src/lib/effect/schemas';

interface OrganizerUpdate {
  readonly userId: string;
  readonly isOrganizer: boolean;
}

type RoleFilter = 'all' | 'organizer' | 'member';

async function updateOrganizerRole({userId, isOrganizer}: OrganizerUpdate): Promise<void> {
  const response = await fetch(`/api/admin/organizers/${userId}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({isOrganizer}),
  });
  if (!response.ok) {
    const data: unknown = await response.json();
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Failed to update organizer role';
    throw new Error(message);
  }
}

export function OrganizerManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const membersQuery = useQuery({
    queryKey: ['admin', 'organizer-members', search],
    queryFn: () =>
      Effect.runPromise(
        getMembers({
          page: 1,
          pageSize: 100,
          query: search || undefined,
        }),
      ),
    staleTime: 60_000,
  });
  const roleMutation = useMutation({
    mutationFn: updateOrganizerRole,
    onSuccess: async (_, update) => {
      queryClient.setQueriesData<GetMembersResponse>(
        {queryKey: ['admin', 'organizer-members']},
        (current) =>
          current
            ? {
                ...current,
                members: current.members.map((member) =>
                  member.user?.id === update.userId
                    ? {
                        ...member,
                        user: {...member.user, isOrganizer: update.isOrganizer},
                      }
                    : member,
                ),
              }
            : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['admin', 'organizer-members']}),
        queryClient.invalidateQueries({queryKey: ['admin', 'members']}),
      ]);
    },
  });

  const members: MemberWithMembership[] = membersQuery.data?.members ?? [];
  const filteredMembers = members.filter((member) => {
    if (roleFilter === 'all') return true;
    const isOrganizer = member.user?.isOrganizer === true;
    return roleFilter === 'organizer' ? isOrganizer : !isOrganizer;
  });

  return (
    <Box sx={{display: 'grid', gap: 3}}>
      <Paper className="dec-card" sx={{p: 3}}>
        <Box sx={{display: 'flex', gap: 2, alignItems: 'center', mb: 1}}>
          <ManageAccountsIcon color="primary" />
          <Typography variant="h4" component="h2">
            Organizer access
          </Typography>
        </Box>
        <Typography color="text.secondary">
          Organizers can view membership reports, send password reset emails, and update trail
          status. They cannot change members, access payments, run reconciliation, or manage roles.
          Organizer access is available only while their membership is current.
        </Typography>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: {xs: 'stretch', sm: 'center'},
          flexDirection: {xs: 'column', sm: 'row'},
        }}
      >
        <TextField
          label="Search members"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name or email"
          size="small"
          sx={{flex: 1}}
        />
        <ToggleButtonGroup
          value={roleFilter}
          exclusive
          size="small"
          onChange={(_, value: RoleFilter | null) => {
            if (value) setRoleFilter(value);
          }}
          aria-label="Filter by role"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="organizer">Organizers</ToggleButton>
          <ToggleButton value="member">Members</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {roleMutation.error && <Alert severity="error">{roleMutation.error.message}</Alert>}

      {membersQuery.isLoading ? (
        <Box sx={{display: 'grid', placeItems: 'center', py: 8}}>
          <CircularProgress />
        </Box>
      ) : membersQuery.error ? (
        <Alert severity="error">{membersQuery.error.message}</Alert>
      ) : (
        <TableContainer component={Paper} className="dec-card">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Membership</TableCell>
                <TableCell>Access</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMembers.map((member) => {
                const user = member.user;
                if (!user) return null;
                const isOrganizer = user.isOrganizer === true;
                const hasEligibleMembership = hasCurrentMembership(member.membership);
                const hasOrganizerAccess = isOrganizer && hasEligibleMembership;
                const isUpdating =
                  roleMutation.isPending && roleMutation.variables?.userId === user.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || 'Not set'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {hasEligibleMembership
                        ? member.card?.membershipNumber || 'Current'
                        : 'Inactive'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          hasOrganizerAccess
                            ? 'Organizer'
                            : isOrganizer
                              ? 'Organizer (inactive)'
                              : 'Member'
                        }
                        color={hasOrganizerAccess ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant={isOrganizer ? 'outlined' : 'contained'}
                        color={isOrganizer ? 'error' : 'primary'}
                        disabled={isUpdating || (!isOrganizer && !hasEligibleMembership)}
                        onClick={() =>
                          roleMutation.mutate({userId: user.id, isOrganizer: !isOrganizer})
                        }
                      >
                        {isUpdating ? '…' : isOrganizer ? 'Revoke' : 'Grant'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
