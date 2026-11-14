// Small stroke icons drawn for ScopeShift. Decorative: always aria-hidden, the text next to them carries the meaning.

type IconProps = { className?: string };

function Svg({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const InboxIcon = (props: IconProps) => <Svg {...props}><path d="M4 13l2.5-7h11L20 13" /><path d="M4 13v5a2 2 0 002 2h12a2 2 0 002-2v-5h-5a3 3 0 01-6 0H4z" /></Svg>;
export const ScaleIcon = (props: IconProps) => <Svg {...props}><path d="M12 4v16M7 20h10M5 8h14" /><path d="M5 8l-3 6a3 3 0 006 0L5 8zM19 8l-3 6a3 3 0 006 0l-3-6z" /></Svg>;
export const CalculatorIcon = (props: IconProps) => <Svg {...props}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></Svg>;
export const ChatIcon = (props: IconProps) => <Svg {...props}><path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1120 12z" /><path d="M8.5 11h7M8.5 14h4.5" /></Svg>;
export const DollarIcon = (props: IconProps) => <Svg {...props}><path d="M12 3v18" /><path d="M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.5 0-4 1.3-4 3s1.6 2.5 4 3 4 1.3 4 3.2-1.7 3.3-4.2 3.3c-2.2 0-3.9-.9-4.8-2.3" /></Svg>;
export const ClockIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const CalendarIcon = (props: IconProps) => <Svg {...props}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Svg>;
export const GaugeIcon = (props: IconProps) => <Svg {...props}><path d="M4.5 17a8.5 8.5 0 1115 0" /><path d="M12 13l3.5-4" /><circle cx="12" cy="13.5" r="1.2" /></Svg>;
export const CopyIcon = (props: IconProps) => <Svg {...props}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></Svg>;
export const SaveIcon = (props: IconProps) => <Svg {...props}><path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></Svg>;
export const SparkIcon = (props: IconProps) => <Svg {...props}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" /></Svg>;
export const PlusIcon = (props: IconProps) => <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>;
export const TrashIcon = (props: IconProps) => <Svg {...props}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V4h6v3" /></Svg>;
export const PencilIcon = (props: IconProps) => <Svg {...props}><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></Svg>;
export const DocumentIcon = (props: IconProps) => <Svg {...props}><path d="M6 3h8l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v4h4M8.5 12h7M8.5 16h7" /></Svg>;
export const RefreshIcon = (props: IconProps) => <Svg {...props}><path d="M20 11a8 8 0 00-14.3-4.3L4 9" /><path d="M4 4v5h5M4 13a8 8 0 0014.3 4.3L20 15" /><path d="M20 20v-5h-5" /></Svg>;
export const AlertIcon = (props: IconProps) => <Svg {...props}><path d="M12 4l9 16H3l9-16z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const InfoIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const ShieldIcon = (props: IconProps) => <Svg {...props}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></Svg>;
export const GraduationIcon = (props: IconProps) => <Svg {...props}><path d="M2 9l10-5 10 5-10 5L2 9z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></Svg>;
export const FolderIcon = (props: IconProps) => <Svg {...props}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></Svg>;
export const CheckCircleIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.3 2.3 4.7-5.3" /></Svg>;
export const XCircleIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></Svg>;
export const MinusCircleIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></Svg>;
export const HelpCircleIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 014.8.8c0 1.7-2.4 2.1-2.4 3.4M12 16.5h.01" /></Svg>;
export const QuoteIcon = (props: IconProps) => <Svg {...props}><path d="M9 7H6a2 2 0 00-2 2v3h5V7zM9 12c0 3-1.5 5-4 5M20 7h-3a2 2 0 00-2 2v3h5V7zM20 12c0 3-1.5 5-4 5" /></Svg>;
