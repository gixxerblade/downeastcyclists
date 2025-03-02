"use client"
import { DecLogo, DecSvgOptions } from '@/assets/icons/DecLogo';
import { AppBar, Box, Button, Container, IconButton, Menu, MenuItem, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import { usePathname } from 'next/navigation';

interface Page {
  href: string,
  link: string,
  children?: Page[],
}
const about: Page[] = [
  { href: '/about/leadership', link: 'Leadership' },
  { href: '/about/bylaws', link: 'Club Bylaws' },
  { href: '/about/membership', link: 'Membership' },
  { href: '/about/privacy', link: 'Privacy Policy' },
] satisfies Page[];

const pages: Page[] = [
  { href: '/', link: 'Home' },
  { href: '', link: 'About', children: about },
  { href: '/blog', link: 'Blog' },
] satisfies Page[];

export default function Navbar () {
  const [open, setOpen] = useState(false);
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElDropdown, setAnchorElDropdown] = useState<null | HTMLElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = usePathname();

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleOpenDropdown = (event: React.MouseEvent<HTMLElement>, pageHref: string) => {
    setAnchorElDropdown(event.currentTarget);
    setActiveDropdown(pageHref);
  };

  const handleCloseDropdown = () => {
    setAnchorElDropdown(null);
    setActiveDropdown(null);
  };

  const isHomepage = location === '/';
  
  // Check if current location is a child of the About section
  const isAboutSection = about.some(page => location === page.href);

  const logoColors: DecSvgOptions = isHomepage ? {} : {
    cyclists: '#000',
    details: '#000',
    shadow: 'light-gray',
  }

  return (
    <AppBar component="nav" position="fixed" sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Link href="/">
            <DecLogo height="48" {...logoColors} />
          </Link>
          {/* Mobile menu */}
          <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
              sx={{ my: 2, color: location === '/' ? 'white' : '#F20E02', display: 'block' }}
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
              {pages.map((page) => (
                <MenuItem key={page.href} onClick={handleCloseNavMenu}>
                  <Typography textAlign="center">
                    <Link href={page.href}>
                      {page.link}
                    </Link>
                  </Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Menu */}
          <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Fragment key={page.href}>
                <Button
                  onClick={(e) => page.children?.length
                    ? handleOpenDropdown(e, page.href)
                    : undefined}
                  sx={{ 
                    my: 2, 
                    color: isHomepage ? 'white' : '#F20E02', 
                    display: 'block',
                    fontWeight: location === page.href || (page.children && isAboutSection) ? 'bold' : 'normal',
                    borderBottom: location === page.href || (page.children && isAboutSection) ? '2px solid #F20E02' : 'none',
                  }}
                >
                  {page.children?.length
                    ? page.link
                    : <Link href={page.href}>{page.link}</Link>
                  }
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
                      <MenuItem 
                        key={childPage.href} 
                        onClick={handleCloseDropdown}
                      >
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
        </Toolbar>
      </Container>
    </AppBar>
  );
}
