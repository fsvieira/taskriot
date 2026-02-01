import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    // fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    // fontFamily: "'Chilanka', cursive",
    fontSize: 18, // tamanho base (padrão é 14), aumenta o texto geral

    // Podes definir tamanhos específicos para variantes
    /*h1: {
      fontSize: '3rem', // 48px
    },
    h2: {
      fontSize: '2.5rem', // 40px
    },
    h3: {
      fontSize: '2rem', // 32px
    },
    body1: {
      fontSize: '1.60rem', // 20px
    },
    body2: {
      fontSize: '1.25rem', // 18px
    },*/
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: "'Chilanka', cursive",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          fontFamily: "'Chilanka', cursive",
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontFamily: "'Chilanka', cursive",
        },
      },
    },
    MuiTypography: {
      variants: [
        {
          props: { variant: 'drawer' }, // se quiseres uma variação personalizada
          style: {
            fontFamily: "'Chilanka', cursive",
          },
        },
      ],
    },
  },
});

export default theme;
