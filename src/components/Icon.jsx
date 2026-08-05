import {
  Bag,
  Bell,
  Bicycle,
  ArrowClockwise,
  CaretLeft,
  Check,
  Clock,
  Coffee,
  DownloadSimple,
  Eye,
  EyeSlash,
  ForkKnife,
  GearSix,
  Gift,
  Heart,
  House,
  ImageSquare,
  List,
  MagnifyingGlass,
  Minus,
  PencilSimple,
  Phone,
  Play,
  Plus,
  QrCode,
  SealPercent,
  ShareNetwork,
  SignOut,
  ShoppingCartSimple,
  Sparkle,
  Star,
  Storefront,
  Tag,
  Trash,
  UserCircle,
  WarningCircle,
  Wallet,
  X
} from "@phosphor-icons/react";

const iconComponents = {
  home: House,
  store: Storefront,
  menu: List,
  dish: ForkKnife,
  tag: Tag,
  sale: SealPercent,
  star: Star,
  bag: Bag,
  cart: ShoppingCartSimple,
  bike: Bicycle,
  bell: Bell,
  refresh: ArrowClockwise,
  heart: Heart,
  image: ImageSquare,
  share: ShareNetwork,
  back: CaretLeft,
  trash: Trash,
  gear: GearSix,
  check: Check,
  clock: Clock,
  search: MagnifyingGlass,
  edit: PencilSimple,
  eye: Eye,
  eyeOff: EyeSlash,
  user: UserCircle,
  phone: Phone,
  play: Play,
  gift: Gift,
  cup: Coffee,
  qr: QrCode,
  download: DownloadSimple,
  warning: WarningCircle,
  wallet: Wallet,
  logout: SignOut,
  minus: Minus,
  plus: Plus,
  close: X
};

export default function Icon({ name, size = 20, className = "", weight = "bold" }) {
  const IconComponent = iconComponents[name] || Sparkle;

  return (
    <IconComponent
      className={`icon-ux ${className}`.trim()}
      size={size}
      weight={weight}
      aria-hidden="true"
      focusable="false"
    />
  );
}
