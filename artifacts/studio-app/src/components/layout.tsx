import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Camera,
  Aperture,
  Menu,
  X,
  LogOut,
  MousePointerClick,
  Paintbrush,
  FileText,
  Upload,
  CalendarDays,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/sessions", label: "Book Shoot", icon: Calendar },
  { href: "/capture-sessions", label: "Capture Sessions", icon: Camera },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const roleItems: NavItem[] = React.useMemo(() => {
    const items: NavItem[] = [];
    items.push({ href: "/shooting-mode", label: "Shoot", icon: Aperture });
    if (user?.name === "Philip") {
      items.push({ href: "/selection", label: "Selection", icon: MousePointerClick });
    }
    if (user?.name === "Smitz") {
      items.push({ href: "/retouch", label: "Retouch", icon: Paintbrush });
    }
    if (user?.name === "Oskar" || user?.name === "Agnes") {
      items.push({ href: "/naming", label: "Naming", icon: FileText });
    }
    if (user?.name === "Oskar") {
      items.push({ href: "/upload", label: "Upload", icon: Upload });
    }
    return items;
  }, [user?.name]);

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex flex-col w-[240px] shrink-0 bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
        <div className="px-5 h-14 flex items-center gap-2.5 border-b border-sidebar-border">
          <Aperture className="w-6 h-6 text-emerald-400" />
          <span className="font-bold text-base tracking-tight">Ridestore Studio</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-sidebar-active text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-active/60 hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}

          <div className="my-3 border-t border-sidebar-border" />

          {roleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "text-muted-foreground hover:bg-sidebar-active/60 hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium truncate">{user?.name}</span>
            <button
              onClick={logout}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-sidebar-active"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 md:ml-[240px]">
        <header className="md:hidden sticky top-0 z-50 bg-sidebar border-b border-sidebar-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 text-muted-foreground hover:text-foreground"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <Aperture className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-base tracking-tight">Ridestore Studio</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{user?.name}</span>
            <button
              onClick={logout}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-sidebar-border bg-sidebar px-4 py-3 space-y-1 z-40">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-active text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-active/60 hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-sidebar-border" />
            {roleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-emerald-900/40 text-emerald-400"
                    : "text-muted-foreground hover:bg-sidebar-active/60 hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
