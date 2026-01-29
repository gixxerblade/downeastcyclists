'use client';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  SxProps,
  Theme,
  Toolbar,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {Fragment, useEffect, useRef, useState} from 'react';

import {DecLogo, DecSvgOptions} from '@/assets/icons/DecLogo';
import {useAuth} from '@/src/components/auth/AuthProvider';

interface Page {
  href: string;
  link: string;
  children?: Page[];
  isExternal?: boolean;
}
const about: Page[] = [
  {href: '/about/leadership', link: 'Leadership'},
  {href: '/about/bylaws', link: 'Club Bylaws'},
  {href: '/about/membership', link: 'Membership'},
  {href: '/about/privacy', link: 'Privacy Policy'},
] satisfies Page[];

const trails: Page[] = [{href: '/trails/b3', link: 'Big Branch Bike Park'}] satisfies Page[];

const pages: Page[] = [
  {href: '/', link: 'Home'},
  {
    href: 'https://www.meetup.com/down-east-cyclists/events/calendar/',
    link: 'Events',
    isExternal: true,
  },
  {href: '', link: 'About', children: about},
  {href: '/blog', link: 'Blog'},
  {href: '/trails', link: 'Trails', children: trails},
  {href: '/contact', link: 'Contact'},
] satisfies Page[];

export default function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElDropdown, setAnchorElDropdown] = useState<null | HTMLElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = usePathname();
  const router = useRouter();

  // Auth state from AuthProvider
  const {user, loading, signOut: handleSignOut} = useAuth();

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  // Function to handle opening the dropdown on click (for mobile)
  const _handleOpenDropdown = (event: React.MouseEvent<HTMLElement>, pageHref: string) => {
    setAnchorElDropdown(event.currentTarget);
    setActiveDropdown(pageHref);
  };

  // Function to handle closing the dropdown
  const handleCloseDropdown = () => {
    setAnchorElDropdown(null);
    setActiveDropdown(null);
  };

  // Function to handle mouse enter on the button
  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>, pageHref: string) => {
    setAnchorElDropdown(event.currentTarget);
    setActiveDropdown(pageHref);
  };

  // Function to handle mouse leave from the dropdown system
  const handleMouseLeave = () => {
    handleCloseDropdown();
  };

  // Add a container ref to track hover state
  const containerRef = useRef<HTMLDivElement>(null);

  // Use useEffect to add a global mouseout event listener
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCloseDropdown();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []);

  // Handle auth button click
  const handleAuthButtonClick = async () => {
    if (user) {
      // Logout
      await handleSignOut();
      router.push('/');
    } else {
      // Login
      router.push('/login');
    }
  };

  const isHomepage = location === '/';

  // Check if current location is a child of a specific section
  const isAboutSection = about.some((page) => location === page.href);
  const isTrailsSection = trails.some((page) => location === page.href);

  const logoColors: DecSvgOptions = isHomepage
    ? {}
    : {
        cyclists: '#000',
        details: '#000',
        shadow: 'light-gray',
      };

  const appBarSx: SxProps<Theme> = isHomepage
    ? {
        backgroundColor: 'transparent',
        boxShadow: 'none',
      }
    : {
        backgroundColor: 'inherit',
        boxShadow: '0 2px 4px 0 rgba(0,0,0,.2)',
      };

  return (
    <AppBar component="nav" position="fixed" sx={appBarSx}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{justifyContent: 'space-between'}}>
          <Link href="/">
            <DecLogo height="48" {...logoColors} />
          </Link>
          {/* Mobile menu */}
          <Box sx={{display: {xs: 'flex', md: 'none'}}}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
              sx={{my: 2, color: location === '/' ? 'white' : '#F20E02', display: 'block'}}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
            >
              {pages.map((page) =>
                page.children ? (
                  // For pages with children (like About), render both parent and children
                  <Fragment key={page.href}>
                    {/* Parent item as a header */}
                    <MenuItem
                      sx={{
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        pointerEvents: 'none', // Make it non-clickable as it's just a header
                      }}
                    >
                      <Typography textAlign="center" fontWeight="bold">
                        {page.link}
                      </Typography>
                    </MenuItem>

                    {/* Child items with indent */}
                    {page.children.map((childPage) => (
                      <MenuItem
                        key={childPage.href}
                        onClick={handleCloseNavMenu}
                        sx={{pl: 4}} // Add left padding for indent
                      >
                        <Typography textAlign="center">
                          <Link href={childPage.href}>{childPage.link}</Link>
                        </Typography>
                      </MenuItem>
                    ))}
                  </Fragment>
                ) : (
                  // For regular pages without children
                  <MenuItem key={page.href} onClick={handleCloseNavMenu}>
                    <Typography textAlign="center">
                      {page.isExternal ? (
                        <a href={page.href} target="_blank" rel="noopener noreferrer">
                          {page.link}
                        </a>
                      ) : (
                        <Link href={page.href}>{page.link}</Link>
                      )}
                    </Typography>
                  </MenuItem>
                ),
              )}
              {/* Auth buttons in mobile menu */}
              {!loading && (
                <>
                  {!user ? (
                    <MenuItem
                      onClick={handleCloseNavMenu}
                      sx={{borderTop: '1px solid rgba(0,0,0,0.12)', mt: 1, pt: 1}}
                    >
                      <Typography textAlign="center" fontWeight="bold">
                        <Link href="/join">Join</Link>
                      </Typography>
                    </MenuItem>
                  ) : (
                    <MenuItem
                      onClick={handleCloseNavMenu}
                      sx={{borderTop: '1px solid rgba(0,0,0,0.12)', mt: 1, pt: 1}}
                    >
                      <Typography textAlign="center" fontWeight="bold">
                        <Link href="/member">My Account</Link>
                      </Typography>
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={() => {
                      handleCloseNavMenu();
                      handleAuthButtonClick();
                    }}
                    sx={user ? {borderTop: '1px solid rgba(0,0,0,0.12)', mt: 1, pt: 1} : {}}
                  >
                    <Typography textAlign="center" fontWeight="bold">
                      {user ? 'Logout' : 'Login'}
                    </Typography>
                  </MenuItem>
                </>
              )}
            </Menu>
          </Box>

          {/* Menu */}
          <Box ref={containerRef} sx={{display: {xs: 'none', md: 'flex'}}}>
            {pages.map((page) => (
              <Fragment key={page.href}>
                <Button
                  onMouseEnter={(e) =>
                    page.children?.length ? handleMouseEnter(e, page.href) : undefined
                  }
                  sx={{
                    my: 2,
                    color: isHomepage ? 'white' : '#F20E02',
                    display: 'block',
                    fontWeight:
                      location === page.href ||
                      (page.link === 'About' && isAboutSection) ||
                      (page.link === 'Trails' && isTrailsSection)
                        ? 'bold'
                        : 'normal',
                    borderBottom:
                      location === page.href ||
                      (page.link === 'About' && isAboutSection) ||
                      (page.link === 'Trails' && isTrailsSection)
                        ? '2px solid #F20E02'
                        : 'none',
                  }}
                >
                  {page.children?.length ? (
                    page.link
                  ) : page.isExternal ? (
                    <a href={page.href} target="_blank" rel="noopener noreferrer">
                      {page.link}
                    </a>
                  ) : (
                    <Link href={page.href}>{page.link}</Link>
                  )}
                </Button>
                {page.children && page.children.length > 0 && (
                  <Menu
                    anchorEl={anchorElDropdown}
                    open={Boolean(anchorElDropdown) && activeDropdown === page.href}
                    onClose={handleCloseDropdown}
                    MenuListProps={{
                      'aria-labelledby': 'dropdown-button',
                      dense: true,
                    }}
                    slotProps={{
                      paper: {
                        sx: {mt: 0}, // Remove margin between button and menu
                        onMouseLeave: handleMouseLeave,
                      },
                    }}
                    keepMounted
                    disablePortal
                    disableAutoFocus={true}
                    disableEnforceFocus={true}
                    disableAutoFocusItem={true}
                    disableRestoreFocus={true}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                  >
                    {page.children.map((childPage) => (
                      <MenuItem key={childPage.href} onClick={handleCloseDropdown}>
                        <Typography textAlign="center">
                          <Link
                            href={childPage.href}
                            style={{
                              textDecoration: 'none',
                              color: location === childPage.href ? '#F20E02' : 'inherit',
                              display: 'block',
                              width: '100%',
                              fontWeight: location === childPage.href ? 'bold' : 'normal',
                            }}
                          >
                            {childPage.link}
                          </Link>
                        </Typography>
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </Fragment>
            ))}
          </Box>

          {/* Auth buttons for desktop */}
          {!loading && (
            <Box sx={{display: {xs: 'none', md: 'flex'}, ml: 2, gap: 1}}>
              {!user ? (
                <Button
                  component={Link}
                  href="/join"
                  variant="contained"
                  sx={{
                    my: 2,
                    color: 'white',
                    backgroundColor: '#F20E02',
                    '&:hover': {
                      backgroundColor: '#d10d02',
                    },
                  }}
                >
                  Join
                </Button>
              ) : (
                <Button
                  component={Link}
                  href="/member"
                  variant="contained"
                  sx={{
                    my: 2,
                    color: 'white',
                    backgroundColor: '#F20E02',
                    '&:hover': {
                      backgroundColor: '#d10d02',
                    },
                  }}
                >
                  My Account
                </Button>
              )}
              <Button
                onClick={handleAuthButtonClick}
                variant="outlined"
                sx={{
                  my: 2,
                  color: isHomepage ? 'white' : '#F20E02',
                  borderColor: isHomepage ? 'white' : '#F20E02',
                  '&:hover': {
                    backgroundColor: 'rgba(242, 14, 2, 0.1)',
                    borderColor: '#F20E02',
                  },
                }}
              >
                {user ? 'Logout' : 'Login'}
              </Button>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
