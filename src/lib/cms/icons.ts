import {
  LayoutDashboard, Users, Users2, Target, Newspaper, AlertTriangle, XCircle, Hourglass,
  CheckSquare, Calendar, Megaphone, FolderOpen, Image, FileText, PieChart, BarChart3,
  Bell, LayoutGrid, Sliders, Shield, Settings2, Wrench, FlaskConical, ClipboardList,
  BookOpen, Package, Clock, FileCheck, Search, Bot, GraduationCap, Microscope, QrCode, Thermometer,
  FileHeart, Droplets, TestTubes, Blend,
} from 'lucide-react';

export const NAV_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Users2, Target, Newspaper, AlertTriangle, XCircle, Hourglass,
  CheckSquare, Calendar, Megaphone, FolderOpen, Image, FileText, PieChart, BarChart3,
  Bell, LayoutGrid, Sliders, Shield, Settings2, Wrench, FlaskConical, ClipboardList,
  BookOpen, Package, Clock, FileCheck, Search, Bot, GraduationCap, Microscope, QrCode, Thermometer,
  FileHeart, Droplets, TestTubes, Blend,
};

export function getNavIcon(name: string) {
  return NAV_ICON_MAP[name] ?? LayoutDashboard;
}
