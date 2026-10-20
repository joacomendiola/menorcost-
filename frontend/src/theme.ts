import { createTheme, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#EEF3FE',
  '#DBE6FD',
  '#B8CCFB',
  '#91B0F7',
  '#6F97F4',
  '#4A7BF0',
  '#3D6AD9',
  '#2F55C8',
  '#2748A8',
  '#1E3884',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 5,
  colors: { brand },
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: '800',
  },
  defaultRadius: 'md',
  radius: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '24px',
  },
  components: {
    TextInput: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    Button: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { radius: 'lg' } },
  },
});
