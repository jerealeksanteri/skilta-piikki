/**
 * Design tokens shared by the UI components. Colours live in CSS variables
 * (styles/global.css) so they follow the Telegram theme; these are the
 * sizes the app uses everywhere.
 */

export const space = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

export const radius = {
  xs: '6px',
  sm: '8px',
  md: '10px',
  lg: '12px',
  chip: '14px',
  pill: '20px',
} as const;

export const fontSize = {
  xs: '11px',
  sm: '12px',
  md: '13px',
  base: '14px',
  lg: '15px',
} as const;

export const zIndex = {
  nav: 100,
  overlay: 200,
  toast: 300,
} as const;

/** Distance from the bottom of the screen that clears the fixed tab bar. */
export const aboveNav = '104px';
