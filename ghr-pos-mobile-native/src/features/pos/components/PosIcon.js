import React from "react";

import {
  BadgeHelp,
  Banknote,
  Clock3,
  CreditCard,
  Gift,
  History,
  LoaderCircle,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Ticket,
  Trash2,
  UserRound,
  WalletCards
} from "lucide-react-native/dist/cjs/lucide-react-native";

const ICONS = {
  brand: Store,
  sale: ShoppingCart,
  history: History,
  shift: WalletCards,
  settings: Settings,
  customer: UserRound,
  cart: ShoppingCart,
  clear: Trash2,
  cash: Banknote,
  qr: CreditCard,
  order: Receipt,
  voucher: Ticket,
  points: Gift,
  pending: Clock3,
  open: PackagePlus,
  loading: LoaderCircle,
  help: BadgeHelp
};

export default function PosIcon({ name, size = 18, color = "#334155", strokeWidth = 2 }) {
  const IconComponent = ICONS[name] || BadgeHelp;
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
