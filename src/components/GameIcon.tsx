import React from 'react';
import {
  DollarSign, Zap, Factory, ShoppingCart, Gem, TrendingUp, Dices,
  User, Trophy, Settings, Sparkles, HelpCircle, Shield, KeyRound,
  Banknote, Home, BarChart3, MousePointerClick, Car, Plane, Ship,
  Image, CreditCard, Diamond, Search, Rocket, Bomb, Coins, Bird,
  Flame, Briefcase, HardHat, Handshake, ClipboardList, Building2,
  Trash2, Dice3, Send, MessageCircle, Gamepad2, Play, ScrollText, Store,
  Lock, Users, Megaphone, Crown, FileText, LogOut, DoorOpen,
  ShoppingBag, Truck, UtensilsCrossed, GraduationCap, Stethoscope,
  Monitor, Landmark, Dribbble, Fuel, PlaneTakeoff, Package,
  Tag, CarFront, Anchor, Palmtree, Watch, Paintbrush, Cpu,
  Flag, CircleDollarSign, Droplets, Dog, Circle,
  Pill, Castle, Beer, MapPin, Box,
  Sun, Eye, Hexagon, SquareStack, Star
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Master icon map — every game icon referenced by a unique key
const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  // Navigation
  'earning': DollarSign,
  'upgrade': Zap,
  'business': Factory,
  'shop': ShoppingCart,
  'accessories': Gem,
  'investments': TrendingUp,
  'casino': Dices,
  'profile': User,
  'forbes': Trophy,
  'settings': Settings,
  'authors': Sparkles,
  'faq': HelpCircle,
  'admin': Shield,
  'login': KeyRound,

  // Earning
  'passive': Banknote,
  'rent': Home,
  'dividends': BarChart3,
  'click': MousePointerClick,

  // Profile / Stats
  'car': Car,
  'plane': Plane,
  'ship': Ship,
  'nft': Image,
  'wallet': CircleDollarSign,
  'balance': CreditCard,
  'stocks': BarChart3,
  'diamond': Diamond,
  'crypto': CircleDollarSign,
  'search': Search,

  // Casino
  'rocket': Rocket,
  'bomb': Bomb,
  'coinflip': Coins,
  'heads': Bird,
  'tails': Coins,
  'crash': Flame,
  'gem': Diamond,

  // Business
  'briefcase': Briefcase,
  'build': HardHat,
  'merge': Handshake,
  'taxes': ClipboardList,
  'building': Building2,
  'delete': Trash2,
  'random': Dice3,

  // Authors / Social
  'telegram': Send,
  'vk': MessageCircle,
  'steam': Gamepad2,
  'youtube': Play,

  // FAQ
  'rules': ScrollText,
  'privacy': Lock,

  // Admin
  'users': Users,
  'announce': Megaphone,
  'crown': Crown,
  'logs': FileText,
  'logout': LogOut,
  'door': DoorOpen,
  'gamepad': Gamepad2,

  // Business categories
  'retail': ShoppingBag,
  'taxi': Truck,
  'food': UtensilsCrossed,
  'manufacturing': Factory,
  'construction': HardHat,
  'education': GraduationCap,
  'medicine': Stethoscope,
  'auto-dealer': CarFront,
  'it': Monitor,
  'bank': Landmark,
  'sports': Dribbble,
  'oil': Fuel,
  'airline': PlaneTakeoff,

  // Shop categories
  'realestate': Home,
  'cars': Car,
  'ships': Ship,
  'planes': Plane,
  'garage': CarFront,
  'hangar': HardHat,
  'dock': Anchor,
  'islands': Palmtree,

  // Accessory categories
  'watches': Watch,
  'jewelry': Diamond,
  'art': Paintbrush,
  'electronics': Cpu,
  'classics': Flag,
  'artifacts': Crown,
  'misc': Package,
  'market': Store,

  // Stock IDs (matching investmentData asset ids)
  'aapl': Monitor,
  'googl': Search,
  'tsla': Car,
  'amzn': Package,
  'msft': Monitor,
  'nvda': Gamepad2,
  'jpm': Landmark,
  'ko': Beer,
  'dis': Castle,
  'ba': Plane,
  'xom': Fuel,
  'pfe': Pill,

  // Legacy stock name keys
  'apple': Monitor,
  'google': Search,
  'tesla': Car,
  'amazon': Package,
  'microsoft': Monitor,
  'nvidia': Gamepad2,
  'jpmorgan': Landmark,
  'cocacola': Beer,
  'disney': Castle,
  'boeing': Plane,
  'exxon': Fuel,
  'pfizer': Pill,

  // Crypto IDs (matching investmentData asset ids)
  'btc': CircleDollarSign,
  'eth': Hexagon,
  'sol': Sun,
  'bnb': Hexagon,
  'ada': Hexagon,
  'xrp': Droplets,
  'doge': Dog,
  'dot': Circle,

  // Misc UI
  'location': MapPin,
  'capacity': Box,
  'tag': Tag,
  'plate': CarFront,
  'loading': Circle,
  'empty': BarChart3,
  'medal-1': Trophy,
  'medal-2': Trophy,
  'medal-3': Trophy,
  'star': Star,
  'eye': Eye,
};

// Color presets for icons matching the game palette
const COLOR_PRESETS: Record<string, string> = {
  earning: 'hsl(var(--sky-400))',
  upgrade: 'hsl(45 93% 47%)',
  business: 'hsl(var(--sky-500))',
  shop: 'hsl(var(--sky-300))',
  accessories: 'hsl(271 81% 56%)',
  investments: 'hsl(142 60% 45%)',
  casino: 'hsl(25 95% 53%)',
  profile: 'hsl(var(--sky-400))',
  forbes: 'hsl(45 93% 47%)',
  settings: 'hsl(var(--muted-foreground))',
  authors: 'hsl(var(--sky-300))',
  faq: 'hsl(var(--muted-foreground))',
  admin: 'hsl(45 93% 47%)',
  rocket: 'hsl(25 95% 53%)',
  market: 'hsl(142 60% 45%)',
  bomb: 'hsl(var(--destructive))',
  coinflip: 'hsl(45 93% 47%)',
  heads: 'hsl(45 93% 47%)',
  tails: 'hsl(var(--sky-400))',
  crash: 'hsl(var(--destructive))',
  gem: 'hsl(142 60% 45%)',
  passive: 'hsl(142 60% 45%)',
  rent: 'hsl(var(--sky-400))',
  dividends: 'hsl(var(--sky-500))',
  wallet: 'hsl(45 93% 47%)',
  diamond: 'hsl(271 81% 56%)',
  crypto: 'hsl(25 95% 53%)',
  search: 'hsl(var(--sky-400))',
  build: 'hsl(var(--sky-500))',
  delete: 'hsl(var(--destructive))',
  crown: 'hsl(45 93% 47%)',
  star: 'hsl(45 93% 47%)',

  // Stock icons
  aapl: 'hsl(0 0% 60%)',
  googl: 'hsl(217 91% 60%)',
  tsla: 'hsl(0 72% 55%)',
  amzn: 'hsl(25 95% 53%)',
  msft: 'hsl(207 90% 54%)',
  nvda: 'hsl(142 60% 45%)',
  jpm: 'hsl(217 71% 53%)',
  ko: 'hsl(0 72% 55%)',
  dis: 'hsl(271 81% 56%)',
  ba: 'hsl(207 90% 54%)',
  xom: 'hsl(0 72% 55%)',
  pfe: 'hsl(207 90% 54%)',

  // Crypto icons
  btc: 'hsl(25 95% 53%)',
  eth: 'hsl(271 81% 56%)',
  sol: 'hsl(271 81% 56%)',
  bnb: 'hsl(45 93% 47%)',
  ada: 'hsl(217 91% 60%)',
  xrp: 'hsl(var(--sky-400))',
  doge: 'hsl(45 93% 47%)',
  dot: 'hsl(338 75% 55%)',
};

interface GameIconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
  /** Use preset color from the game palette */
  themed?: boolean;
}

const GameIcon: React.FC<GameIconProps> = ({ name, size = 20, className = '', color, themed = false }) => {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    // Fallback: render a circle with the first letter
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {name[0]?.toUpperCase() || '?'}
      </span>
    );
  }

  const iconColor = color || (themed ? COLOR_PRESETS[name] : 'currentColor');

  return (
    <IconComponent
      size={size}
      color={iconColor}
      className={className}
      strokeWidth={2}
    />
  );
};

export default GameIcon;
export { ICON_MAP, COLOR_PRESETS };
