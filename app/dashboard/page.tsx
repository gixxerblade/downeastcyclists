'use client';

import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

import {ActionLog} from '@/src/components/admin/ActionLog';
import {MembershipManagement} from '@/src/components/admin/MembershipManagement';
import {OrganizerManagement} from '@/src/components/admin/OrganizerManagement';
import {ReconciliationTool} from '@/src/components/admin/ReconciliationTool';
import {TrailMaintenanceManagement} from '@/src/components/admin/TrailMaintenanceManagement';
import {useAuth} from '@/src/components/auth/AuthProvider';
import TrailStatus from '@/src/components/TrailStatus';
import TrailStatusEditor from '@/src/components/TrailStatusEditor';
import type {StaffRole} from '@/src/lib/access-control';

type AdminSection =
  | 'overview'
  | 'members'
  | 'action-log'
  | 'trails'
  | 'trail-maintenance'
  | 'reconciliation'
  | 'organizers';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  trails: number;
  events: number;
  blogPosts: number;
  expiredMembers?: number;
  canceledMembers?: number;
  individualCount?: number;
  familyCount?: number;
  yearlyRevenue?: number;
  expiringSoonMembers?: number;
  newMembersThisMonth?: number;
  membershipGrowth?: ReadonlyArray<{readonly month: string; readonly count: number}>;
}

const allSections: Array<{
  id: AdminSection;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}> = [
  {id: 'overview', label: 'Overview', icon: <DashboardIcon fontSize="small" />},
  {id: 'members', label: 'Members', icon: <PeopleAltIcon fontSize="small" />},
  {id: 'action-log', label: 'Action Log', icon: <ReceiptLongIcon fontSize="small" />},
  {id: 'trails', label: 'Trail status', icon: <DirectionsBikeIcon fontSize="small" />},
  {
    id: 'trail-maintenance',
    label: 'Maintenance',
    icon: <ReportProblemIcon fontSize="small" />,
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    icon: <SyncAltIcon fontSize="small" />,
    adminOnly: true,
  },
  {
    id: 'organizers',
    label: 'Organizers',
    icon: <ManageAccountsIcon fontSize="small" />,
    adminOnly: true,
  },
];

function AdminMark() {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pb: 3}}>
      <Box
        sx={{
          width: 40,
          height: 40,
          bgcolor: '#F20E02',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Anton, sans-serif',
          transform: 'skewX(-6deg)',
        }}
      >
        <Box component="span" sx={{transform: 'skewX(6deg)'}}>
          DEC
        </Box>
      </Box>
      <Box
        sx={{fontFamily: 'Anton, sans-serif', lineHeight: 1, letterSpacing: '.04em', fontSize: 13}}
      >
        ADMIN
        <br />
        <Box component="span" sx={{color: '#8B8B90'}}>
          CONSOLE
        </Box>
      </Box>
    </Box>
  );
}

function StatCard({
  label,
  value,
  accent,
  dark = false,
}: {
  label: string;
  value: string | number;
  accent?: string;
  dark?: boolean;
}) {
  return (
    <Card
      sx={{
        bgcolor: dark ? '#16130F' : 'var(--dec-surface)',
        color: dark ? '#fff' : 'var(--dec-ink)',
      }}
    >
      <CardContent>
        <Typography variant="body2" sx={{color: dark ? '#B8B8BD' : 'var(--dec-muted-2)'}}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: 'Anton, sans-serif',
            fontSize: 34,
            color: accent || 'inherit',
            mt: 0.5,
            minHeight: 42,
          }}
        >
          {value ?? ''}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [section, setSection] = useState<AdminSection>('overview');
  const router = useRouter();
  const {user, loading, signOut} = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    trails: 1,
    events: 12,
    blogPosts: 36,
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();

        if (!data.authenticated) {
          router.replace('/login');
          return;
        }

        if (data.role !== 'admin' && data.role !== 'organizer') {
          setAuthError('You are not authorized to access this dashboard.');
          signOut().then(() => router.replace('/login'));
          return;
        }

        setStaffRole(data.role);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setAuthError('Failed to verify admin access.');
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!loading && user) {
      checkAdminStatus();
    } else if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router, signOut]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          setDashboardStats((prev) => ({
            ...prev,
            totalMembers: data.totalMembers || 0,
            activeMembers: data.activeMembers || 0,
            expiredMembers: data.expiredMembers,
            canceledMembers: data.canceledMembers,
            individualCount: data.individualCount,
            familyCount: data.familyCount,
            yearlyRevenue: data.yearlyRevenue,
            expiringSoonMembers: data.expiringSoonMembers,
            newMembersThisMonth: data.newMembersThisMonth,
            membershipGrowth: data.membershipGrowth,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    if (staffRole) fetchStats();
  }, [staffRole]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      window.history.replaceState(null, '', '/');
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loading || checkingAdmin) {
    return (
      <Container>
        <Box sx={{display: 'flex', justifyContent: 'center', mt: 8}}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (authError || !staffRole) {
    return (
      <Container>
        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8}}>
          <Typography color="error" variant="h6" gutterBottom>
            {authError || 'Access denied'}
          </Typography>
          <Typography>You will be redirected to the login page.</Typography>
          <CircularProgress sx={{mt: 2}} />
        </Box>
      </Container>
    );
  }

  const sections = allSections.filter((item) => !item.adminOnly || staffRole === 'admin');
  const sectionTitle = sections.find((item) => item.id === section)?.label || 'Overview';

  return (
    <Box className="dec-admin-page" sx={{display: 'flex', minHeight: 'calc(100vh - 76px)'}}>
      <Box
        component="aside"
        sx={{
          width: 250,
          flexShrink: 0,
          bgcolor: '#000',
          color: '#F5F3EF',
          display: {xs: 'none', md: 'flex'},
          flexDirection: 'column',
          py: 3,
          borderRight: '1px solid rgba(255,255,255,.08)',
          position: 'sticky',
          top: 76,
          height: 'calc(100vh - 76px)',
        }}
      >
        <AdminMark />
        <Typography
          sx={{
            px: 3,
            pb: 1,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.1em',
            color: '#6A6A6F',
          }}
        >
          MANAGE
        </Typography>
        <Box component="nav" sx={{display: 'flex', flexDirection: 'column', gap: 0.25, px: 1.5}}>
          {sections.map((item) => (
            <Button
              key={item.id}
              onClick={() => setSection(item.id)}
              startIcon={item.icon}
              sx={{
                justifyContent: 'flex-start',
                color: section === item.id ? '#fff' : '#B8B8BD',
                bgcolor: section === item.id ? '#F20E02' : 'transparent',
                borderRadius: 1.25,
                px: 1.5,
                '&:hover': {bgcolor: section === item.id ? '#F20E02' : 'rgba(255,255,255,.06)'},
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            disabled
            startIcon={<QrCodeScannerIcon fontSize="small" />}
            sx={{justifyContent: 'flex-start', px: 1.5}}
          >
            Verify (QR) · SOON
          </Button>
        </Box>

        <Box sx={{mt: 'auto', px: 1.5}}>
          <Box
            sx={{
              borderTop: '1px solid rgba(255,255,255,.1)',
              pt: 2,
              display: 'flex',
              gap: 1.25,
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                bgcolor: '#F20E02',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
              }}
            >
              {(user?.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}
            </Box>
            <Box sx={{minWidth: 0, flex: 1}}>
              <Typography noWrap sx={{fontSize: 13, fontWeight: 800}}>
                {user?.displayName || user?.email?.split('@')[0] || 'Admin'}
              </Typography>
              <Typography sx={{fontSize: 11, color: '#8B8B90'}}>
                {staffRole === 'admin' ? 'Administrator' : 'Organizer'}
              </Typography>
            </Box>
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              size="small"
              sx={{minWidth: 0, color: '#8B8B90'}}
            >
              <LogoutIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{flex: 1, minWidth: 0}}>
        <Box
          sx={{
            px: {xs: 2, md: 4},
            py: {xs: 2, md: 2.5},
            borderBottom: '1px solid var(--dec-border)',
            bgcolor: 'var(--dec-admin-bg)',
          }}
        >
          <Typography variant="h2" sx={{fontSize: {xs: 28, md: 32}, lineHeight: 1}}>
            {sectionTitle}
          </Typography>
        </Box>

        <Box
          sx={{
            display: {xs: 'flex', md: 'none'},
            gap: 1,
            overflowX: 'auto',
            p: 2,
            borderBottom: '1px solid var(--dec-border)',
          }}
        >
          {sections.map((item) => (
            <Button
              key={item.id}
              variant={section === item.id ? 'contained' : 'outlined'}
              onClick={() => setSection(item.id)}
              sx={{whiteSpace: 'nowrap'}}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        <Box sx={{p: {xs: 2, md: 4}}}>
          {section === 'overview' && (
            <Box sx={{display: 'grid', gap: 3}}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {xs: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))'},
                  gap: 2,
                }}
              >
                <StatCard label="Total members" value={dashboardStats.totalMembers} />
                <StatCard label="Active" value={dashboardStats.activeMembers} accent="#1F8A5B" />
                <StatCard
                  label="Expiring (30d)"
                  value={dashboardStats.expiringSoonMembers ?? ''}
                  accent="#C7801A"
                />
                <StatCard label="New this month" value={dashboardStats.newMembersThisMonth ?? ''} />
                <StatCard
                  label="Annual revenue"
                  value={
                    dashboardStats.yearlyRevenue != null
                      ? `$${dashboardStats.yearlyRevenue.toLocaleString()}`
                      : ''
                  }
                  accent="#7CF3A0"
                  dark
                />
              </Box>

              <Box
                sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', lg: '1.5fr 1fr'}, gap: 3}}
              >
                <Paper className="dec-card" sx={{p: 3}}>
                  <Typography variant="h4" component="h2" sx={{mb: 3}}>
                    Membership growth
                  </Typography>
                  {dashboardStats.membershipGrowth?.length ? (
                    <Box sx={{height: 280}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dashboardStats.membershipGrowth.map((item) => ({
                            month: item.month,
                            members: item.count,
                          }))}
                          margin={{top: 10, right: 8, left: -18, bottom: 0}}
                        >
                          <CartesianGrid stroke="var(--dec-border)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{fill: 'var(--dec-muted-2)', fontSize: 12, fontWeight: 700}}
                          />
                          <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{fill: 'var(--dec-muted-2)', fontSize: 12, fontWeight: 700}}
                          />
                          <Tooltip
                            cursor={{fill: 'rgba(242,14,2,.08)'}}
                            contentStyle={{
                              background: 'var(--dec-surface)',
                              border: '1px solid var(--dec-border)',
                              borderRadius: 12,
                              color: 'var(--dec-ink)',
                              fontFamily: 'Poppins, sans-serif',
                            }}
                            labelStyle={{fontWeight: 800}}
                          />
                          <Bar dataKey="members" fill="#F20E02" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        minHeight: 220,
                        display: 'grid',
                        placeItems: 'center',
                        border: '1px dashed var(--dec-border)',
                        borderRadius: 2,
                      }}
                    >
                      <Typography color="text.secondary">
                        No membership growth data available.
                      </Typography>
                    </Box>
                  )}
                </Paper>
                <Box sx={{display: 'grid', gap: 3}}>
                  <Paper className="dec-card" sx={{p: 3}}>
                    <Typography variant="h4" component="h2" sx={{mb: 2}}>
                      Trail snapshot
                    </Typography>
                    <TrailStatus showTitle={false} maxItems={2} />
                  </Paper>
                  <Paper className="dec-card" sx={{p: 3}}>
                    <Typography variant="h4" component="h2" sx={{mb: 2}}>
                      Quick actions
                    </Typography>
                    <Box sx={{display: 'grid', gap: 1.5}}>
                      <Button variant="contained" onClick={() => setSection('members')}>
                        Manage members
                      </Button>
                      <Button variant="outlined" onClick={() => setSection('trails')}>
                        Update trail status
                      </Button>
                      <Button variant="outlined" onClick={() => setSection('trail-maintenance')}>
                        Review trail reports
                      </Button>
                      {staffRole === 'admin' && (
                        <Button variant="outlined" onClick={() => setSection('reconciliation')}>
                          Run reconciliation
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </Box>
              </Box>
            </Box>
          )}

          {section === 'members' && <MembershipManagement role={staffRole} />}

          {section === 'action-log' && <ActionLog />}

          {section === 'trails' && (
            <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', lg: '1fr 1fr'}, gap: 3}}>
              <Paper className="dec-card" sx={{p: 3}}>
                <Typography variant="h4" component="h2" sx={{mb: 2}}>
                  Current status
                </Typography>
                <TrailStatus showTitle={false} />
              </Paper>
              <Paper className="dec-card" sx={{p: 3}}>
                <TrailStatusEditor />
              </Paper>
            </Box>
          )}

          {section === 'trail-maintenance' && <TrailMaintenanceManagement />}

          {section === 'reconciliation' && staffRole === 'admin' && <ReconciliationTool />}

          {section === 'organizers' && staffRole === 'admin' && <OrganizerManagement />}
        </Box>
      </Box>
    </Box>
  );
}
