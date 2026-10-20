/**
 * The console's icon vocabulary: one Hugeicons (Stroke Rounded, free) icon per meaning, used everywhere that
 * meaning appears (console UI standard §1, spec §3.6). Render with `<Icon icon={…} />` from `./icon`.
 * This is the only module that imports @hugeicons/core-free-icons (architecture test); named re-exports keep
 * every icon tree-shakeable, so a route only ships the icons it renders. Add a meaning here before using a new
 * icon, and reuse an existing meaning rather than picking a second glyph for it.
 */
export {
  // Navigation / sections
  DashboardSquare01Icon as OverviewIcon,
  CubeIcon as FleetIcon, // Fleet, a managed item (palette result, empty states)
  ComputerTerminal01Icon as SessionsIcon, // Sessions, session lists, "No sessions"
  SparklesIcon as AiUsageIcon,
  Globe02Icon as InternetIcon, // Internet, internet access (tile, chart panels, empty states)
  Analytics01Icon as ReportsIcon, // Usage reports
  HierarchySquare01Icon as InfraIcon, // Infra, topology
  Notification03Icon as AlertsIcon, // Alerts & SLOs, "No alerts firing"
  Task01Icon as LogIcon, // Logs and history lists
  UserMultiple02Icon as UsersIcon, // People (tiles, panels, column headers)
  UserListIcon as AllUsersIcon, // Nav child: all users
  UserCheck01Icon as ActiveUserIcon, // Nav child: active users
  UserBlock01Icon as InactiveUserIcon, // Nav child: inactive users

  // Metrics
  CpuIcon,
  RamMemoryIcon as RamIcon,
  HardDriveIcon as DiskIcon, // Home disk, free on /data
  DashboardSpeed02Icon as GaugeIcon, // Load, current usage, budget and quota
  ArrowDataTransferVerticalIcon as NetworkIcon, // Network traffic
  BotIcon as AiRequestsIcon, // AI requests (tile, recent requests, "No requests")
  AlertCircleIcon as FailedIcon, // Failed requests, inline form errors
  ArrowUpToLineIcon as InputTokensIcon,
  ArrowDownToLineIcon as OutputTokensIcon,
  Coins01Icon as TokensIcon,
  SecurityBlockIcon as DeniedIcon, // Denied access, frequently denied domains
  CheckListIcon as AllowlistIcon, // Internet allowlist (panel, empty state)
  CheckmarkCircle02Icon as SuccessIcon, // Allowed access, all clear, success toast
  PercentIcon as ShareIcon, // Denied share
  ServerStack01Icon as ComponentsIcon, // Infra components, infra health
  Target03Icon as TargetIcon, // Monitoring targets
  Award01Icon as TopIcon, // Top developers
  LeftToRightListNumberIcon as RankedListIcon, // Top denied domains, horizontal-bar rankings
  Clock01Icon as TimeIcon,
  Activity01Icon as ActivityIcon,
  BulbIcon as InsightIcon,
  GitBranchIcon as BranchIcon, // Git branch of a repository (Fleet Working on, Projects, Activity review)
  GitCommitIcon as CommitIcon, // Commits
  Folder01Icon as FolderIcon, // Repositories, AI sessions outside a repository
  Calendar03Icon as CalendarIcon, // Activity review period
  PrinterIcon as PrintIcon,
  PencilEdit02Icon as EditIcon, // Edit an About summary
  RotateLeftIcon as ResetIcon, // Reset to the automatic summary
  ViewOffIcon as HideIcon, // Hide a repository from reviews, hide a shown password
  ViewIcon as ShowIcon, // Show a masked password

  // Charts
  ChartColumnIcon as ColumnChartIcon,
  ChartLineData01Icon as LineChartIcon,
  PieChartIcon,
  GridViewIcon as HeatmapIcon,

  // Status and feedback
  Alert02Icon as WarningIcon,
  InformationCircleIcon as InfoIcon,
  CancelCircleIcon as ErrorIcon, // Error toast
  SecurityCheckIcon as SecureIcon, // Security settings, two-factor authentication
  Loading03Icon as SpinnerIcon, // Animate with `motion-safe:animate-spin`
  FileUnknownIcon as NotFoundIcon,

  // Actions and controls
  Search01Icon as SearchIcon,
  SearchRemoveIcon as NoResultsIcon,
  RefreshIcon, // Refresh, reload, try again
  Download04Icon as ExportIcon,
  LinkSquare02Icon as ExternalLinkIcon,
  Copy01Icon as CopyIcon,
  Tick02Icon as CheckIcon,
  CloudUploadIcon as UploadIcon, // File upload drop zone
  File01Icon as FileIcon, // An uploaded file without a preview
  Image01Icon as ImageIcon, // An image file before its preview loads
  Delete02Icon as RemoveIcon, // Remove a file from an upload list
  Cancel01Icon as CloseIcon,
  MoreHorizontalIcon as MoreIcon,
  CommandLineIcon as CommandsIcon,
  Key01Icon as KeyIcon,
  IdCardIcon as IdentityIcon,
  Layers01Icon as SurfacesIcon,
  Moon02Icon as ThemeDarkIcon,
  Sun03Icon as ThemeLightIcon,
  Logout01Icon as SignOutIcon,
  ArrowUp02Icon as ArrowUpIcon, // Delta up, sort ascending
  ArrowDown02Icon as ArrowDownIcon, // Delta down, sort descending
  ArrowRight02Icon as ArrowRightIcon, // "Go to page" links
  ArrowDown01Icon as ChevronDownIcon,
  ArrowLeft01Icon as ChevronLeftIcon,
  ArrowRight01Icon as ChevronRightIcon,
  ArrowLeftDoubleIcon as ChevronsLeftIcon, // First page
  ArrowRightDoubleIcon as ChevronsRightIcon, // Last page
  UnfoldMoreIcon as ChevronsUpDownIcon, // Unsorted column, account switcher
  PanelLeftOpenIcon as SidebarCollapseIcon, // Hugeicons names are the reverse of Lucide's: this glyph points left
  PanelLeftCloseIcon as SidebarExpandIcon, // …and this one points right
  Menu01Icon as MenuIcon, // Open the navigation drawer (phone top bar)
  CircleIcon as DotIcon, // Radio item indicator (filled with `fill-current`)
} from "@hugeicons/core-free-icons";
