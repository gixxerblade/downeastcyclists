'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Divider,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import { PeopleAlt, DirectionsBike, Event, Article } from '@mui/icons-material';
import TrailStatus from '@/src/components/TrailStatus';
import TrailStatusEditor from '@/src/components/TrailStatusEditor';
import { TrailData } from '@/src/utils/trails';
import { signOutUser, auth } from '@/src/utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Tab panel component for the dashboard
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const router = useRouter();

  // Get the allowed email from environment variable
  const ALLOWED_EMAIL = process.env.NEXT_PUBLIC_ALLOWED_EMAIL || 'your-admin-email@example.com';
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check if the auth token exists
    const hasToken = document.cookie.includes('auth-token=');
    
    if (!hasToken) {
      // If no token, redirect to login
      router.replace('/login');
      return;
    }
    
    // Check Firebase authentication state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // No user is signed in, redirect to login
        router.replace('/login');
        return;
      }
      
      // Check if the user's email is allowed
      if (user.email !== ALLOWED_EMAIL) {
        setAuthError('You are not authorized to access this dashboard.');
        // Sign out the user
        signOutUser().then(() => {
          document.cookie = 'auth-token=; path=/; max-age=0';
          router.replace('/login');
        });
        return;
      }
      
      // User is authenticated and authorized
      setIsLoading(false);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router, ALLOWED_EMAIL]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Sign out from Firebase
      await signOutUser();
      
      // Clear the auth token cookie
      document.cookie = 'auth-token=; path=/; max-age=0';
      
      // Clear browser history before redirecting
      window.history.replaceState(null, '', '/login');
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  if (authError) {
    return (
      <Container>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
          <Typography color="error" variant="h6" gutterBottom>
            {authError}
          </Typography>
          <Typography>
            You will be redirected to the login page.
          </Typography>
          <CircularProgress sx={{ mt: 2 }} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Admin Dashboard
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleLogout}
          disabled={isLoggingOut}
          startIcon={isLoggingOut ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoggingOut ? 'Logging Out...' : 'Logout'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Members" />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PeopleAlt sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4">124</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Trails" />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DirectionsBike sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4">8</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Events" />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Event sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4">12</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Blog Posts" />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Article sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4">36</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Welcome to the Down East Cyclists Admin Dashboard
            </Typography>
            <Typography paragraph>
              This dashboard provides administrative tools and analytics for managing the Down East Cyclists website.
              From here, you can manage content, view statistics, and update site information.
            </Typography>
            <Typography paragraph>
              Note: This is a protected area that requires authentication to access.
            </Typography>
          </Paper>
        </Grid>

        {/* Trail Status Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Trail Status Management
            </Typography>
            <Typography paragraph>
              View and update the status of all trails. Toggle trails between open and closed, and add notes about current conditions.
            </Typography>
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="trail status tabs">
                <Tab label="View Status" id="dashboard-tab-0" aria-controls="dashboard-tabpanel-0" />
                <Tab label="Update Status" id="dashboard-tab-1" aria-controls="dashboard-tabpanel-1" />
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              <TrailStatus showTitle={false} />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <TrailStatusEditor />
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
