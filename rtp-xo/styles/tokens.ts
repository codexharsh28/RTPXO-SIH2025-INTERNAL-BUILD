/**
 * RTPXO - CTC/SCADA Industrial Railway Design System Tokens
 *
 * Near-black #0B0E11 base, signal-accurate railway color semantics,
 * JetBrains Mono for telemetry/kinematics, Inter for SCADA UI labels,
 * cyan #00B4D8 as the exclusive AI-optimization accent, 4px/8px spatial grid.
 */

export const tokens = {
  // 1. BASE BACKGROUND & SURFACE PALETTE (Near-Black CTC / SCADA)
  surfaces: {
    base: "#0B0E11", // Master viewport / background
    panel: "#11161B", // Primary operational panels & toolbars
    surface: "#141B22", // Card surfaces & table containers
    elevated: "#1A232C", // Hover states, modals, floating popovers
    overlay: "rgba(11, 14, 17, 0.85)", // Glassmorphism backdrop tint
    gridLine: "#182028", // SVG map coordinate grid lines
  },

  // 2. BORDERS & DIVIDERS
  borders: {
    subtle: "#1C2630", // Standard panel dividers
    default: "#243240", // Card and container borders
    strong: "#334455", // Active/selected container borders
    focus: "#00B4D8", // Active focus ring
  },

  // 3. TEXT & FOREGROUND CONTENT
  text: {
    primary: "#F1F5F9", // Primary readings, train IDs, speeds
    secondary: "#94A3B8", // Labels, headers, units (km/h, %)
    muted: "#64748B", // Inactive captions, metadata
    disabled: "#475569", // Inactive buttons, placeholders
    inverse: "#0B0E11", // Text on bright badges
  },

  // 4. SIGNAL-ACCURATE STATUS PALETTE (Railway Interlocking Standard)
  signals: {
    // Green: Clear / Proceed / On Time / Nominal Flow
    green: {
      base: "#10B981",
      hover: "#059669",
      dark: "#064E3B",
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.40)",
      glow: "0 0 10px rgba(16, 185, 129, 0.50)",
    },
    // Amber/Yellow: Caution / Pacing / Moderate Saturation / Delay
    amber: {
      base: "#F59E0B",
      hover: "#D97706",
      dark: "#78350F",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.40)",
      glow: "0 0 10px rgba(245, 158, 11, 0.50)",
    },
    // Double Yellow: Preliminary Caution / Attention Aspect
    yellow: {
      base: "#EAB308",
      hover: "#CA8A04",
      dark: "#713F12",
      bg: "rgba(234, 179, 8, 0.12)",
      border: "rgba(234, 179, 8, 0.40)",
      glow: "0 0 10px rgba(234, 179, 8, 0.50)",
    },
    // Red: Stop / Danger / Safety Conflict / Critical Incident
    red: {
      base: "#EF4444",
      hover: "#DC2626",
      dark: "#7F1D1D",
      bg: "rgba(239, 68, 68, 0.15)",
      border: "rgba(239, 68, 68, 0.50)",
      glow: "0 0 12px rgba(239, 68, 68, 0.60)",
    },
    // Purple/Violet: Train Held / Interlocking Hold / Staged
    purple: {
      base: "#8B5CF6",
      hover: "#7C3AED",
      dark: "#4C1D95",
      bg: "rgba(139, 92, 246, 0.12)",
      border: "rgba(139, 92, 246, 0.40)",
    },
  },

  // 5. EXCLUSIVE AI-OPTIMIZATION ACCENT (Cyan #00B4D8)
  ai: {
    primary: "#00B4D8", // AI Score, recommendation badge, ghost trains
    bright: "#48CAE4", // Active glow, highlight hover, pulsing nodes
    dark: "#0077B6", // Pressed buttons, secondary AI borders
    deep: "#03045E", // Deep AI panel backgrounds
    bg: "rgba(0, 180, 216, 0.10)", // Translucent recommendation cards
    border: "rgba(0, 180, 216, 0.40)", // AI container borders
    glow: "0 0 12px rgba(0, 180, 216, 0.55)", // AI node glow
  },

  // 6. SPACING GRID (4px / 8px Modular Scale)
  spacing: {
    0.5: "2px", // Micro padding (table badges, mini tags)
    1: "4px", // Tight gap (buttons, status indicators)
    1.5: "6px", // Metric cards inner padding
    2: "8px", // Standard panel inner padding / grid gap
    3: "12px", // Card padding / section gap
    4: "16px", // Dashboard container gutter
    6: "24px", // Large workspace separator
    8: "32px", // Modal padding
  },

  // 7. CRISP INDUSTRIAL BORDER RADII
  radius: {
    none: "0px",
    xs: "2px", // Badges, mini buttons, block tags
    sm: "3px", // Standard buttons, metric cells
    md: "4px", // Panel corners, cards
    lg: "6px", // Modal containers, drawer panels
    pill: "9999px", // Indicator dots, status pills
  },

  // 8. TYPOGRAPHY SCALES
  typography: {
    fonts: {
      data: "var(--font-jetbrains-mono), monospace", // Telemetry, speeds, timestamps, km
      ui: "var(--font-inter), sans-serif", // Labels, headers, action titles
    },
    sizes: {
      micro: { size: "7.5px", lineHeight: "10px" },
      tag: { size: "9px", lineHeight: "12px" },
      caption: { size: "10px", lineHeight: "14px" },
      bodySm: { size: "11px", lineHeight: "16px" },
      body: { size: "12px", lineHeight: "18px" },
      subhead: { size: "13px", lineHeight: "18px" },
      header: { size: "14px", lineHeight: "20px" },
      title: { size: "16px", lineHeight: "22px" },
      kpi: { size: "20px", lineHeight: "24px" },
      hero: { size: "28px", lineHeight: "32px" },
    },
  },
} as const;

export type DesignTokens = typeof tokens;
