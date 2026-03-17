const baseIconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

export const StartTreatmentIcon = ({ className = 'h-4 w-4 text-current' }) => (
  <svg {...baseIconProps} className={className}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export const OwnerTabIcon = ({ className = 'h-4 w-4 text-current' }) => (
  <svg {...baseIconProps} className={className}>
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
    <path d="M5 21a7 7 0 0 1 14 0" />
  </svg>
);

export const HistoryTabIcon = ({ className = 'h-4 w-4 text-current' }) => (
  <svg {...baseIconProps} className={className}>
    <path d="M3 5h18" />
    <path d="M21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
    <path d="M9 12h6" />
  </svg>
);

export const ReportsTabIcon = ({ className = 'h-4 w-4 text-current' }) => (
  <svg {...baseIconProps} className={className}>
    <path d="M6 3h12l-2 7a6 6 0 1 1-8 0Z" />
    <path d="M12 14v4" />
    <path d="m9 18 3 3 3-3" />
  </svg>
);

export const BloodReportIcon = ({ className = 'h-6 w-6 text-rose-600' }) => (
  <svg {...baseIconProps} className={className}>
    <path d="M12 3s5 6 5 9a5 5 0 0 1-10 0c0-3 5-9 5-9Z" />
  </svg>
);

export const XrayIcon = ({ className = 'h-6 w-6 text-sky-600' }) => (
  <svg {...baseIconProps} className={className}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M7 6h10" />
    <path d="M7 10h10" />
    <path d="m9 14 6 6" />
    <path d="M15 14l-6 6" />
  </svg>
);

export const LabSummaryIcon = ({ className = 'h-6 w-6 text-emerald-600' }) => (
  <svg {...baseIconProps} className={className}>
    <path d="M6 2h4v7.5L3.5 20a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L14 9.5V2h4" />
    <path d="M9 14h6" />
  </svg>
);
