import {createTheme} from '@mui/material/styles';

export type AppThemeMode = 'light' | 'dark';

const brandRed = '#F20E02';

const createAppTheme = (mode: AppThemeMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: brandRed,
        dark: '#b30a01',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#2FBFA0',
      },
      success: {
        main: mode === 'light' ? '#1F8A5B' : '#7CF3A0',
      },
      background: {
        default: mode === 'light' ? '#FAF7F2' : '#0E0E10',
        paper: mode === 'light' ? '#FFFFFF' : '#18181B',
      },
      text: {
        primary: mode === 'light' ? '#16130F' : '#F5F3EF',
        secondary: mode === 'light' ? '#5C554B' : '#C8C8CC',
      },
      divider: mode === 'light' ? '#E7E0D5' : 'rgba(255,255,255,.1)',
    },
    typography: {
      fontFamily: 'Poppins, sans-serif',
      h1: {fontFamily: 'Anton, sans-serif', letterSpacing: 0, textTransform: 'uppercase'},
      h2: {fontFamily: 'Anton, sans-serif', letterSpacing: 0, textTransform: 'uppercase'},
      h3: {fontFamily: 'Anton, sans-serif', letterSpacing: 0, textTransform: 'uppercase'},
      h4: {fontFamily: 'Anton, sans-serif', letterSpacing: 0, textTransform: 'uppercase'},
      h5: {fontWeight: 700},
      button: {fontWeight: 700, textTransform: 'none'},
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: mode === 'light' ? '#FAF7F2' : '#0E0E10',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ownerState}) => ({
            ...(ownerState.severity === 'info' && {
              backgroundColor: '#60a5fa',
            }),
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 12,
            boxShadow: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            border: mode === 'light' ? '1px solid #EAE3D8' : '1px solid rgba(255,255,255,.08)',
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiContainer: {
        styleOverrides: {
          root: {
            [createTheme().breakpoints.down('sm')]: {
              maxWidth: '100% !important',
              paddingLeft: '16px',
              paddingRight: '16px',
            },
          },
        },
      },
    },
  });

export default createAppTheme;
