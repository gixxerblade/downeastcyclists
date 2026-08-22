import type {SxProps, Theme} from '@mui/material/styles';

export const mobileAdminNavigationSx = {
  display: {xs: 'flex', md: 'none'},
  gap: 1,
  overflowX: 'auto',
  p: 2,
  borderBottom: '1px solid var(--dec-border)',
} satisfies SxProps<Theme>;

export const mobileAdminNavigationButtonSx = {
  whiteSpace: 'nowrap',
  flexShrink: 0,
} satisfies SxProps<Theme>;
