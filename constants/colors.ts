/**
 * Color palette for the NFC Card Reader app
 * Optimized for both light and dark modes
 */

export const Colors = {
  light: {
    primary: '#007AFF',
    primaryDark: '#0051D5',
    primaryLight: '#4DA3FF',
    secondary: '#34C759',
    secondaryDark: '#248A3D',
    danger: '#FF3B30',
    dangerDark: '#D70015',
    warning: '#FF9500',
    background: '#FFFFFF',
    backgroundSecondary: '#F2F2F7',
    backgroundTertiary: '#E5E5EA',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',
    border: '#C6C6C8',
    borderLight: '#E5E5EA',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.4)',
    success: '#34C759',
    info: '#5AC8FA',
  },
  dark: {
    primary: '#0A84FF',
    primaryDark: '#0051D5',
    primaryLight: '#64B5FF',
    secondary: '#30D158',
    secondaryDark: '#248A3D',
    danger: '#FF453A',
    dangerDark: '#D70015',
    warning: '#FF9F0A',
    background: '#000000',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#8E8E93',
    border: '#38383A',
    borderLight: '#2C2C2E',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    success: '#30D158',
    info: '#64D2FF',
  },
};

export type ColorScheme = 'light' | 'dark';

