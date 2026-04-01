import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  Bookmark,
  CheckCircle,
  CircleDot,
  Eye,
  Flag,
  Flame,
  Inbox,
  Lightbulb,
  Pause,
  Play,
  Rocket,
  Search,
  Shield,
  SkipForward,
  Settings,
  Star,
  Target,
  Clock,
  Zap,
} from "lucide-react";
import type { StageIconName } from "@/lib/kanban";

export const STAGE_ICON_MAP: Record<StageIconName, LucideIcon> = {
  inbox: Inbox,
  search: Search,
  play: Play,
  eye: Eye,
  "check-circle": CheckCircle,
  "circle-dot": CircleDot,
  clock: Clock,
  pause: Pause,
  "skip-forward": SkipForward,
  archive: Archive,
  rocket: Rocket,
  lightbulb: Lightbulb,
  flame: Flame,
  bookmark: Bookmark,
  bell: Bell,
  shield: Shield,
  settings: Settings,
  flag: Flag,
  target: Target,
  zap: Zap,
  star: Star,
};

export const getStageIconLabel = (icon: StageIconName) =>
  icon
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
