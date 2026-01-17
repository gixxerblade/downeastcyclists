'use client';

import {PeopleAlt, DirectionsBike, Event} from '@mui/icons-material';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';

import {MembershipManagement} from '@/src/components/admin/MembershipManagement';
import {useAuth} from '@/src/components/auth/AuthProvider';
import TrailStatus from '@/src/components/TrailStatus';
import TrailStatusEditor from '@/src/components/TrailStatusEditor';
import {refreshStats} from '@/src/lib/effect/client-admin';
import type {FirestoreError, UnauthorizedError} from '@/src/lib/effect/errors';
import type {MembershipStats} from '@/src/lib/effect/schemas';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  trails: number;
  events: number;
  blogPosts: number;
}

// Tab panel component for the dashboard
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{pt: 3}}>{children}</Box>}
    </div>
  );
}

export default function DashboardPage() {
  const [tabValue, setTabValue] = useState(0);
  const router = useRouter();
  const {user, loading, signOut} = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    trails: 1, // Static for now
    events: 12, // Static for now
    blogPosts: 36, // Static for now
  });

  // TanStack Query mutation for refreshing stats (following Effect-TS architecture)
  const refreshStatsMutation = useMutation<
    MembershipStats,
    FirestoreError | UnauthorizedError,
    void
  >({
    mutationFn: () => Effect.runPromise(refreshStats()),
    onSuccess: (data) => {
      setDashboardStats((prev) => ({
        ...prev,
        totalMembers: data.totalMembers || 0,
        activeMembers: data.activeMembers || 0,
      }));
    },
  });

  // Check admin status using custom claims
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();

        if (!data.authenticated) {
          // Not authenticated at all
          router.replace('/login');
          return;
        }

        if (!data.isAdmin) {
          // Authenticated but not admin
          setAuthError('You are not authorized to access this dashboard.');
          signOut().then(() => {
            router.replace('/login');
          });
          return;
        }

        // User is admin
        setIsAdmin(true);
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

  // Fetch dashboard stats
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
          }));
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  if (authError || !isAdmin) {
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

  return (
    <Container maxWidth="lg" sx={{mt: {xs: 8, sm: 4}, mb: 4}}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: {xs: 'column', sm: 'row'},
          justifyContent: 'space-between',
          alignItems: {xs: 'flex-start', sm: 'center'},
          mb: 4,
          gap: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Admin Dashboard
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: {xs: 'column', sm: 'row'},
            alignItems: {xs: 'flex-start', sm: 'center'},
            gap: 2,
          }}
        >
          {user && (
            <Typography
              variant="body1"
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                mr: {xs: 0, sm: 2},
              }}
            >
              Welcome,{' '}
              <Typography
                component="span"
                variant="body1"
                sx={{
                  fontWeight: 'bold',
                  ml: 0.5,
                  mr: 1,
                }}
              >
                {user.displayName || user.email?.split('@')[0] || user.email}
              </Typography>
            </Typography>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleLogout}
            disabled={isLoggingOut}
            startIcon={isLoggingOut ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{
              minWidth: {xs: '100%', sm: 'auto'},
            }}
          >
            {isLoggingOut ? 'Logging Out...' : 'Logout'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Stats Section Header with Refresh Button */}
        <Grid item xs={12}>
          <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
            <Typography variant="h5" component="h2">
              Membership Overview
            </Typography>
            <Button
              variant="outlined"
              onClick={() => refreshStatsMutation.mutate()}
              disabled={refreshStatsMutation.isPending}
              startIcon={refreshStatsMutation.isPending ? <CircularProgress size={20} /> : null}
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
        </Grid>

        {/* Stats Cards */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Total Members" />
            <CardContent>
              <Box sx={{display: 'flex', alignItems: 'center'}}>
                <PeopleAlt sx={{fontSize: 40, mr: 2, color: '#1976d2'}} />
                <Typography variant="h4">{dashboardStats.totalMembers}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Active Members" />
            <CardContent>
              <Box sx={{display: 'flex', alignItems: 'center'}}>
                <PeopleAlt sx={{fontSize: 40, mr: 2, color: '#2e7d32'}} />
                <Typography variant="h4">{dashboardStats.activeMembers}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Trails" />
            <CardContent>
              <Box sx={{display: 'flex', alignItems: 'center'}}>
                <DirectionsBike sx={{fontSize: 40, mr: 2}} />
                <Typography variant="h4">{dashboardStats.trails}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Events" />
            <CardContent>
              <Box sx={{display: 'flex', alignItems: 'center'}}>
                <Event sx={{fontSize: 40, mr: 2}} />
                <Typography variant="h6">Coming Soon</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12}>
          <Paper sx={{p: 3}}>
            <Typography variant="h5" gutterBottom>
              Welcome to the Down East Cyclists Admin Dashboard
            </Typography>
            <Typography component="p">
              This dashboard provides administrative tools and analytics for managing the Down East
              Cyclists website. From here, you can manage content, view statistics, and update site
              information.
            </Typography>
            <Typography component="p">
              Note: This is a protected area that requires authentication to access.
            </Typography>
          </Paper>
        </Grid>

        {/* Management Sections */}
        <Grid item xs={12}>
          <Paper sx={{p: 3}}>
            <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin dashboard tabs">
                <Tab
                  label="Membership Management"
                  id="dashboard-tab-0"
                  aria-controls="dashboard-tabpanel-0"
                />
                <Tab
                  label="View Trail Status"
                  id="dashboard-tab-1"
                  aria-controls="dashboard-tabpanel-1"
                />
                <Tab
                  label="Update Trail Status"
                  id="dashboard-tab-2"
                  aria-controls="dashboard-tabpanel-2"
                />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <MembershipManagement />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <TrailStatus showTitle={false} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TrailStatusEditor />
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
