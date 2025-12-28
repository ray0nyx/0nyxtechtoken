/**
 * Centralized chart color configuration for consistent theming
 * All charts should import colors from this file for consistency
 */

// Gray color palette for Onyx dark theme
export const CHART_COLORS = {
    // Primary colors (for wins/positive values)
    primary: '#a3a3a3',      // neutral-400
    primaryLight: '#d4d4d4', // neutral-300
    primaryDark: '#737373',  // neutral-500

    // Secondary colors (for losses/negative values)
    secondary: '#525252',    // neutral-600
    secondaryLight: '#737373', // neutral-500
    secondaryDark: '#404040',  // neutral-700

    // Accent colors
    accent: '#e5e5e5',       // neutral-200
    accentDark: '#404040',   // neutral-700

    // Text colors
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',

    // Grid and axis colors
    grid: '#333333',
    axis: '#666666',

    // Background colors
    tooltipBg: 'rgba(10, 10, 10, 0.95)',
    cardBg: '#0a0a0a',

    // Border colors
    border: '#262626',       // neutral-800
    borderLight: '#404040',  // neutral-700
} as const;

// Gradient definitions for charts
export const CHART_GRADIENTS = {
    // Gradient for positive/winning values (light gray)
    winsGradient: {
        id: 'grayWinsGradient',
        stops: [
            { offset: '0%', color: '#d4d4d4', opacity: 0.9 },
            { offset: '50%', color: '#a3a3a3', opacity: 0.6 },
            { offset: '100%', color: '#737373', opacity: 0.3 },
        ],
    },

    // Gradient for negative/losing values (dark gray)
    lossesGradient: {
        id: 'grayLossesGradient',
        stops: [
            { offset: '0%', color: '#737373', opacity: 0.9 },
            { offset: '50%', color: '#525252', opacity: 0.6 },
            { offset: '100%', color: '#404040', opacity: 0.3 },
        ],
    },

    // Area fill gradient
    areaGradient: {
        id: 'grayAreaGradient',
        stops: [
            { offset: '5%', color: '#a3a3a3', opacity: 0.3 },
            { offset: '95%', color: '#a3a3a3', opacity: 0.05 },
        ],
    },
} as const;

// Common tooltip styles
export const TOOLTIP_STYLE = {
    backgroundColor: CHART_COLORS.tooltipBg,
    border: `1px solid ${CHART_COLORS.border}`,
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: CHART_COLORS.textPrimary,
    backdropFilter: 'blur(10px)',
} as const;

// Helper function to get gradient JSX for recharts
export const getGradientDefs = () => `
  <linearGradient id="${CHART_GRADIENTS.winsGradient.id}" x1="0" y1="0" x2="0" y2="1">
    ${CHART_GRADIENTS.winsGradient.stops.map(s =>
    `<stop offset="${s.offset}" stopColor="${s.color}" stopOpacity="${s.opacity}" />`
).join('')}
  </linearGradient>
  <linearGradient id="${CHART_GRADIENTS.lossesGradient.id}" x1="0" y1="0" x2="0" y2="1">
    ${CHART_GRADIENTS.lossesGradient.stops.map(s =>
    `<stop offset="${s.offset}" stopColor="${s.color}" stopOpacity="${s.opacity}" />`
).join('')}
  </linearGradient>
`;
