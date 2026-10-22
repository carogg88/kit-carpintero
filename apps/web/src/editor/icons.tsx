/** Íconos de trazo de 2 px, los mismos del diseño final. Siempre decorativos: el texto va en aria-label. */
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;

export const IconBack = () => (
  <svg {...base} width={22} height={22}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const IconUndo = () => (
  <svg {...base}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);
export const IconRedo = () => (
  <svg {...base}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);
export const IconSelect = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M5 3l14 8-6 2-3 6z" />
  </svg>
);
export const IconPush = () => (
  <svg {...base}>
    <path d="M12 15V3M8 7l4-4 4 4" />
    <rect x="4" y="15" width="16" height="6" rx="1" />
  </svg>
);
export const IconMove = () => (
  <svg {...base}>
    <path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
  </svg>
);
export const IconXray = () => (
  <svg {...base} strokeDasharray="3 2">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);
export const IconCopy = () => (
  <svg {...base}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </svg>
);
export const IconLink = () => (
  <svg {...base} width={18} height={18}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base} width={24} height={24} strokeWidth={2.5}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconZoomIn = () => (
  <svg {...base} width={20} height={20}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5M8 11h6M11 8v6" />
  </svg>
);
export const IconZoomOut = () => (
  <svg {...base} width={20} height={20}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5M8 11h6" />
  </svg>
);
export const IconChevron = () => (
  <svg {...base} width={18} height={18}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconWarn = () => (
  <svg {...base} width={16} height={16}>
    <path d="M12 3 2 21h20z" />
    <path d="M12 10v5M12 18v.5" />
  </svg>
);
export const IconModel = () => (
  <svg {...base} width={22} height={22} strokeLinejoin="round">
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </svg>
);
export const IconJoints = () => (
  <svg {...base} width={22} height={22}>
    <rect x="3" y="3" width="8" height="18" />
    <path d="M11 9h10v6H11" />
  </svg>
);
export const IconCuts = () => (
  <svg {...base} width={22} height={22}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
export const IconPlan = () => (
  <svg {...base} width={22} height={22}>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M7 16h10M7 8v8M17 8v8" />
  </svg>
);
export const IconLogo = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
    <rect x="3" y="6" width="22" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M6 11v13M22 11v13" stroke="currentColor" strokeWidth="2" />
  </svg>
);
export const IconInfo = () => (
  <svg {...base} width={18} height={18}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />
  </svg>
);
export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);
export const IconDraw = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13 7 4 4" />
  </svg>
);
export const IconRect = () => (
  <svg {...base}>
    <rect x="4" y="6" width="16" height="12" rx="1" />
  </svg>
);
export const IconCircle = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);
export const IconTrash = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const IconBevel = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M4 20V4h10l6 6v10z" />
    <path d="M14 4v6h6" strokeDasharray="2 2" />
  </svg>
);
export const IconSection = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M10 3h4v11h-4z" />
    <path d="M7 14h10v7H7z" />
  </svg>
);
export const IconTurn = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M9 3h6v3l-1 2 2 3-2 3v2l2 2v3H8v-3l2-2v-2l-2-3 2-3-1-2z" />
  </svg>
);
export const IconRound = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M4 20V4h8a8 8 0 0 1 8 8v8z" />
  </svg>
);
export const IconChamfer = () => (
  <svg {...base} strokeLinejoin="round">
    <path d="M4 20V4h10l6 6v10z" />
  </svg>
);
export const IconArc = () => (
  <svg {...base}>
    <path d="M4 18a8 8 0 0 1 16 0" />
    <path d="M3 18h2M19 18h2" />
  </svg>
);
export const IconClose = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
