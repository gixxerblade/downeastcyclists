'use client';

import {Edit, NavigateBefore, NavigateNext} from '@mui/icons-material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  IconButton,
} from '@mui/material';

import type {MemberWithMembership} from '@/src/lib/effect/schemas';

interface MemberTableProps {
  members: MemberWithMembership[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEditMember: (member: MemberWithMembership) => void;
}

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  canceled: 'error',
  expired: 'error',
  incomplete: 'default',
  incomplete_expired: 'default',
  unpaid: 'error',
};

export function MemberTable({
  members,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEditMember,
}: MemberTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <Paper elevation={2}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Membership #</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => {
              const endDate = member.membership?.endDate;
              const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString() : '-';

              return (
                <TableRow
                  key={member.user?.id || member.card?.membershipNumber}
                  hover
                  sx={{'&:last-child td, &:last-child th': {border: 0}}}
                >
                  <TableCell sx={{fontFamily: 'monospace'}}>
                    {member.card?.membershipNumber || '-'}
                  </TableCell>
                  <TableCell>{member.user?.name || '-'}</TableCell>
                  <TableCell>{member.user?.email}</TableCell>
                  <TableCell>
                    {member.membership?.planType === 'family' ? 'Family' : 'Individual'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={member.membership?.status || 'none'}
                      color={statusColors[member.membership?.status || ''] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formattedEndDate}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="primary" onClick={() => onEditMember(member)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <Typography variant="body2">Rows per page:</Typography>
          <FormControl size="small" sx={{minWidth: 80}}>
            <Select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
          <Typography variant="body2">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </Typography>
          <Box sx={{display: 'flex', gap: 0.5}}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              startIcon={<NavigateBefore />}
            >
              Prev
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              endIcon={<NavigateNext />}
            >
              Next
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
