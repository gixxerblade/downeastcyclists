'use client';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import {AppBar, Box, Button, Container, IconButton, Menu, MenuItem, Toolbar} from '@mui/material';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useState} from 'react';

import {useAuth} from '@/src/components/auth/AuthProvider';
import {useThemeMode} from '@/src/components/ThemeRegistry/ThemeModeContext';

const meetupUrl = 'https://www.meetup.com/down-east-cyclists/events/calendar/';

const navItems = [
  {href: meetupUrl, label: 'Rides ↗', external: true},
  {href: '/trails/b3', label: 'Trails'},
  {href: '/blog', label: 'Blog'},
  {
    href: '/about',
    label: 'About',
    children: [
      {href: '/about/leadership', label: 'Leadership'},
      {href: '/about/bylaws', label: 'Bylaws'},
      {href: '/about/membership', label: 'Membership'},
      {href: '/about/privacy', label: 'Privacy'},
    ],
  },
  {href: '/contact', label: 'Contact'},
];

function DecWordmark({admin = false}: {admin?: boolean}) {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
      <Box
        sx={{
          width: {xs: 38, md: 44},
          height: {xs: 38, md: 44},
          bgcolor: '#F20E02',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Anton, sans-serif',
          fontSize: {xs: 16, md: 20},
          transform: 'skewX(-6deg)',
        }}
      >
        <Box component="span" sx={{transform: 'skewX(6deg)'}}>
          DEC
        </Box>
      </Box>
      <Box
        sx={{
          color: 'var(--dec-ink)',
          fontFamily: 'Anton, sans-serif',
          fontSize: {xs: 12, md: 15},
          lineHeight: 1,
          letterSpacing: '.05em',
        }}
      >
        {admin ? 'ADMIN' : 'DOWN EAST'}
        <br />
        <Box component="span" sx={{color: 'var(--dec-muted-2)'}}>
          {admin ? 'CONSOLE' : 'CYCLISTS'}
        </Box>
      </Box>
    </Box>
  );
}

export default function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const currentPath = pathname || '/';
  const router = useRouter();
  const {mode, toggleMode} = useThemeMode();
  const {user, role, loading, signOut} = useAuth();

  const isActive = (href: string) => {
    if (href === '/trails/b3') return currentPath.startsWith('/trails');
    if (href === '/about') return currentPath.startsWith('/about');
    return currentPath === href;
  };

  const handleAuthClick = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    await signOut();
    router.push('/');
  };

  const closeMenu = () => setAnchorElNav(null);

  return (
    <AppBar
      component="nav"
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: 'color-mix(in srgb, var(--dec-surface) 92%, transparent)',
        borderBottom: '1px solid var(--dec-border)',
        backdropFilter: 'blur(18px)',
        color: 'var(--dec-ink)',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{minHeight: {xs: 68, md: 76}, gap: 2}}>
          <Box component={Link} href="/" sx={{display: 'inline-flex'}}>
            <DecWordmark />
          </Box>

          <Box
            component="nav"
            aria-label="Primary navigation"
            sx={{display: {xs: 'none', md: 'flex'}, gap: 3.5, ml: 'auto', alignItems: 'center'}}
          >
            {navItems.map((item) =>
              item.external ? (
                <Box
                  component="a"
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: 'var(--dec-muted)',
                    fontSize: 14,
                    fontWeight: 600,
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {item.label}
                </Box>
              ) : item.children ? (
                <Box
                  key={item.href}
                  className="group"
                  sx={{
                    position: 'relative',
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <Box
                    component={Link}
                    href={item.href}
                    sx={{
                      color: isActive(item.href) ? 'var(--dec-ink)' : 'var(--dec-muted)',
                      fontSize: 14,
                      fontWeight: isActive(item.href) ? 800 : 600,
                      minHeight: 44,
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderBottom: isActive(item.href)
                        ? '2px solid #F20E02'
                        : '2px solid transparent',
                    }}
                  >
                    {item.label}
                  </Box>
                  <Box
                    className="hidden group-hover:flex group-focus-within:flex"
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: -18,
                      zIndex: 20,
                      minWidth: 210,
                      flexDirection: 'column',
                      gap: 0.5,
                      p: 1,
                      bgcolor: 'var(--dec-surface)',
                      border: '1px solid var(--dec-border)',
                      borderRadius: 2,
                      boxShadow: '0 18px 50px rgba(0,0,0,.18)',
                    }}
                  >
                    {item.children.map((child) => (
                      <Box
                        component={Link}
                        key={child.href}
                        href={child.href}
                        sx={{
                          px: 1.5,
                          py: 1.25,
                          borderRadius: 1.5,
                          color: currentPath === child.href ? '#F20E02' : 'var(--dec-muted)',
                          fontSize: 14,
                          fontWeight: 700,
                          '&:hover': {
                            bgcolor: 'color-mix(in srgb, var(--dec-border) 40%, transparent)',
                          },
                        }}
                      >
                        {child.label}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Box
                  component={Link}
                  key={item.href}
                  href={item.href}
                  sx={{
                    color: isActive(item.href) ? 'var(--dec-ink)' : 'var(--dec-muted)',
                    fontSize: 14,
                    fontWeight: isActive(item.href) ? 800 : 600,
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderBottom: isActive(item.href)
                      ? '2px solid #F20E02'
                      : '2px solid transparent',
                  }}
                >
                  {item.label}
                </Box>
              ),
            )}
          </Box>

          <Box sx={{display: 'flex', alignItems: 'center', gap: {xs: 1, md: 1.5}, ml: 'auto'}}>
            <IconButton
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
              onClick={toggleMode}
              sx={{color: 'var(--dec-ink)', width: 44, height: 44}}
            >
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>

            {!loading && user && role !== 'admin' && (
              <Button
                component={Link}
                href="/member"
                startIcon={<AccountCircleIcon />}
                sx={{
                  display: {xs: 'none', md: 'inline-flex'},
                  color: 'var(--dec-ink)',
                  maxWidth: 190,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                My Account
              </Button>
            )}

            {!loading && user && (
              <Button
                onClick={handleAuthClick}
                variant="outlined"
                sx={{
                  display: {xs: 'none', md: 'inline-flex'},
                  color: 'var(--dec-muted)',
                  borderColor: 'var(--dec-border)',
                  '&:hover': {
                    borderColor: '#F20E02',
                    color: '#F20E02',
                  },
                }}
              >
                Log out
              </Button>
            )}

            {!loading && !user && (
              <Button
                onClick={handleAuthClick}
                sx={{display: {xs: 'none', md: 'inline-flex'}, color: 'var(--dec-muted)'}}
              >
                Log in
              </Button>
            )}

            {!loading && user && (role === 'admin' || role === 'organizer') && (
              <Button
                component={Link}
                href="/dashboard"
                variant="contained"
                sx={{
                  bgcolor: '#F20E02',
                  borderRadius: 999,
                  px: {xs: 2, md: 2.75},
                  '&:hover': {bgcolor: '#b30a01'},
                }}
              >
                Admin Dashboard
              </Button>
            )}

            {!loading && !user && (
              <Button
                component={Link}
                href="/join"
                variant="contained"
                sx={{
                  bgcolor: '#F20E02',
                  borderRadius: 999,
                  px: {xs: 2, md: 2.75},
                  '&:hover': {bgcolor: '#b30a01'},
                }}
              >
                <Box component="span" sx={{display: {xs: 'none', sm: 'inline'}}}>
                  Join the club
                </Box>
                <Box component="span" sx={{display: {xs: 'inline', sm: 'none'}}}>
                  Join
                </Box>
              </Button>
            )}

            <IconButton
              aria-label="Open navigation menu"
              onClick={(event) => setAnchorElNav(event.currentTarget)}
              sx={{
                display: {xs: 'inline-flex', md: 'none'},
                color: 'var(--dec-ink)',
                width: 44,
                height: 44,
              }}
            >
              {anchorElNav ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          </Box>

          <Menu
            anchorEl={anchorElNav}
            open={Boolean(anchorElNav)}
            onClose={closeMenu}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 260,
                  bgcolor: 'var(--dec-surface)',
                  color: 'var(--dec-ink)',
                  border: '1px solid var(--dec-border)',
                  borderRadius: 3,
                },
              },
            }}
          >
            {navItems.map((item) => (
              <Box key={item.href}>
                <MenuItem onClick={closeMenu} sx={{minHeight: 48}}>
                  {item.external ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer">
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href}>{item.label}</Link>
                  )}
                </MenuItem>
                {item.children?.map((child) => (
                  <MenuItem key={child.href} onClick={closeMenu} sx={{minHeight: 44, pl: 4}}>
                    <Link href={child.href}>{child.label}</Link>
                  </MenuItem>
                ))}
              </Box>
            ))}
            {user && role !== 'admin' && (
              <MenuItem onClick={closeMenu} sx={{minHeight: 48}}>
                <Link href="/member">My Account</Link>
              </MenuItem>
            )}
            {user && (role === 'admin' || role === 'organizer') && (
              <MenuItem onClick={closeMenu} sx={{minHeight: 48}}>
                <Link href="/dashboard">Admin Dashboard</Link>
              </MenuItem>
            )}
            <MenuItem onClick={handleAuthClick} sx={{minHeight: 48}}>
              {user ? 'Log out' : 'Log in'}
            </MenuItem>
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
