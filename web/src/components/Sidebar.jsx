import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { projectStore } from '../stores/ProjectStore';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Toolbar,
  Typography,
  Box,
} from '@mui/material';
import {
  ChevronLeft,
  Menu,
  Dashboard,
  Assignment,
  Archive,
  BarChart,
  Repeat,
  AccountCircle,
  PlayArrow,
  Pause,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import LanguageSelector from './LanguageSelector';

const drawerWidthOpen = 240;
const drawerWidthClosed = 64;

const Sidebar = observer(() => {
  const [open, setOpen] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const interval = setInterval(() => {
      setForceUpdate(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dados do timer
  const { timerState, projects } = projectStore;
  const activeProject = projects.find(p => p.id === timerState.activeProjectId);
  const hasActiveTimer = !!timerState.activeProjectId;

  // Formatar tempo (exemplo: HH:MM:SS)
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const elapsed = timerState.startTime ? Date.now() - timerState.startTime : 0;
  const displayTime = timerState.paused ? formatTime(timerState.originalDuration - timerState.timeLeft) : formatTime(elapsed);

  // Define navigation links and their paths
  const menuItems = [
    { text: t('navigation.projects'), icon: <Dashboard />, path: '/' },
    { text: t('navigation.queue'), icon: <Assignment />, path: '/queue' },
    { text: t('navigation.stats'), icon: <BarChart />, path: '/stats' },
    { text: 'Archive', icon: <Archive />, path: '/archive' }, // TODO: implement archive route later
  ];

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? drawerWidthOpen : drawerWidthClosed,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? drawerWidthOpen : drawerWidthClosed,
          transition: 'width 0.3s',
          overflowX: 'hidden',
        },
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
        }}
      >
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{
            fontSize: '1.2rem',
            fontFamily: "'Chilanka', cursive",
          }}
        >
          Task Riot
        </Typography>

        <IconButton edge="end" onClick={() => setOpen(!open)}>
          {open ? <ChevronLeft /> : <Menu />}
        </IconButton>
      </Toolbar>

      <Divider />
      <List>
        {menuItems.map(({ text, icon, path }) => {
          const selected = location.pathname === path;
          return (
            <ListItem key={text} disablePadding>
              <ListItemButton
                component={Link}
                to={path}
                selected={selected}
                sx={{
                  px: 2,
                  backgroundColor: selected ? '#C1DFF0' : 'inherit',
                  '&:hover': {
                    backgroundColor: selected ? '#B0D0E8' : 'action.hover',
                  },
                  color: selected ? 'text.primary' : 'inherit',
                }}
              >
                <ListItemIcon
                  sx={{
                    color: selected ? 'primary.contrastText' : 'inherit',
                    minWidth: 40,
                  }}
                >
                  {icon}
                </ListItemIcon>
                {open && <ListItemText primary={text} />}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      <ListItem disablePadding>
        <ListItemButton
          component={Link}
          to="/account"
          selected={location.pathname === '/account'}
          sx={{
            px: 2,
            backgroundColor: location.pathname === '/account' ? '#C1DFF0' : 'inherit',
            '&:hover': {
              backgroundColor: location.pathname === '/account' ? '#B0D0E8' : 'action.hover',
            },
            color: location.pathname === '/account' ? 'text.primary' : 'inherit',
          }}
        >
          <ListItemIcon
            sx={{
              color: location.pathname === '/account' ? 'primary.contrastText' : 'inherit',
              minWidth: 40,
            }}
          >
            <AccountCircle />
          </ListItemIcon>
          {open && <ListItemText primary={t('account.title')} />}
        </ListItemButton>
      </ListItem>

      {/* Secção do Timer */}
      {hasActiveTimer && (
        <>
          <Divider sx={{ mt: 2 }} />
          <ListItem disablePadding>
            <Box
              sx={{
                width: '100%',
                px: 2,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: open ? 'space-between' : 'center',
              }}
            >
              {open ? (
                <>
                  <Box>
                    <Typography variant="body2" noWrap>
                      {activeProject?.name || 'Projeto Ativo'}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        minWidth: 110,
                        whiteSpace: "nowrap",
                        color: '#0000FF',
                        textShadow: `
                          0 0 1px #00FFFF,
                          0 0 2px #00FFFF,
                          0 0 3px #00FFFF,
                          0 0 5px #00FFFF
                        `,
                        opacity: 0.6,
                        fontSize: '1.3rem',
                        padding: '2px 4px'
                      }}
                    >
                      {displayTime}
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => projectStore.toggleTimer(timerState.activeProjectId)}
                    sx={{ color: "white", backgroundColor: "success.main" }}
                    size="small"
                  >
                    {timerState.paused ? <PlayArrow /> : <Pause />}
                  </IconButton>
                </>
              ) : (
                <IconButton
                  sx={{
                    color: timerState.paused ? 'warning.main' : 'success.main',
                  }}
                  size="small"
                >
                  {timerState.paused ? <Pause /> : <PlayArrow />}
                </IconButton>
              )}
            </Box>
          </ListItem>
        </>
      )}
    </Drawer>
  );
});

export default Sidebar;
