const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const SearchIcon = (p) => <svg {...base} width={26} height={26} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
export const PlayIcon = (p) => <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M7 4.5v15l13-7.5z" /></svg>
export const ChevronLeft = (p) => <svg {...base} width={16} height={16} {...p}><path d="m15 5-7 7 7 7" /></svg>
export const ChevronRight = (p) => <svg {...base} width={16} height={16} {...p}><path d="m9 5 7 7-7 7" /></svg>

export const MenuIcon = (p) => <svg {...base} width={26} height={26} {...p}><path d="M3 7h18M8 12h13M3 17h18" /></svg>
export const BookmarkIcon = (p) => <svg {...base} {...p}><path d="M7 4h10v16l-5-4-5 4z" /></svg>
export const ArrowRight = (p) => <svg {...base} width={16} height={16} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const LibraryIcon = (p) => <svg {...base} width={30} height={30} strokeWidth={1.5} {...p}><path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.5l3.7-1 3 15-3.7 1z" /></svg>
export const FolderIcon = (p) => <svg {...base} width={24} height={24} strokeWidth={1.6} {...p}><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.5h8.4A1.5 1.5 0 0 1 21 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></svg>
export const GridIcon = (p) => <svg {...base} width={26} height={26} strokeWidth={1.6} {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
export const ListIcon = (p) => <svg {...base} width={26} height={26} strokeWidth={1.8} {...p}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>
export const PlusIcon = (p) => <svg {...base} width={18} height={18} {...p}><path d="M12 5v14M5 12h14" /></svg>
export const ImageIcon = (p) => <svg {...base} width={17} height={17} strokeWidth={1.7} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 9" /></svg>
export const TagIcon = (p) => <svg {...base} width={24} height={24} strokeWidth={1.6} {...p}><path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.7 7.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 3 12.2z" /><circle cx="8" cy="8" r="1.3" /></svg>
export const CheckIcon = (p) => <svg {...base} width={12} height={12} strokeWidth={3} {...p}><path d="m5 12 5 5 9-10" /></svg>
export const SparkIcon = (p) => <svg {...base} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
