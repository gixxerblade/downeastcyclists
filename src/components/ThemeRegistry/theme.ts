import { Poppins } from 'next/font/google';
import { createTheme } from '@mui/material/styles';


const poppins = Poppins({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  palette: {
    mode: 'light',
  },
  typography: {
    fontFamily: poppins.style.fontFamily,
  },
  components: {
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.severity === 'info' && {
            backgroundColor: '#60a5fa',
          }),
        }),
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

export default theme;
