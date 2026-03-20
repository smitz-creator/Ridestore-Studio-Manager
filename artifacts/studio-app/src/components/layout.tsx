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
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/capture-sessions", label: "Capture Sessions", icon: Camera },
  { href: "/sessions", label: "Photo Shoots", icon: Calendar },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-1.5 text-muted-foreground hover:text-foreground"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-semibold text-lg tracking-tight">Ridestore Studio</span>
          <nav className="hidden sm:flex items-center gap-1 ml-6">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/shooting-mode"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              location === "/shooting-mode"
                ? "bg-primary text-primary-foreground"
                : "bg-cyan-100 text-cyan-800 hover:bg-cyan-200"
            )}
          >
            <Aperture className="w-4 h-4" />
            <span className="hidden sm:inline">Shoot</span>
          </Link>
          {user?.name === "Philip" && (
            <Link
              href="/selection"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location === "/selection"
                  ? "bg-primary text-primary-foreground"
                  : "bg-pink-100 text-pink-800 hover:bg-pink-200"
              )}
            >
              <MousePointerClick className="w-4 h-4" />
              <span className="hidden sm:inline">Selection</span>
            </Link>
          )}
          {user?.name === "Smitz" && (
            <Link
              href="/retouch"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location === "/retouch"
                  ? "bg-primary text-primary-foreground"
                  : "bg-orange-100 text-orange-800 hover:bg-orange-200"
              )}
            >
              <Paintbrush className="w-4 h-4" />
              <span className="hidden sm:inline">Retouch</span>
            </Link>
          )}
          {(user?.name === "Oskar" || user?.name === "Agnes") && (
            <Link
              href="/naming"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location === "/naming"
                  ? "bg-primary text-primary-foreground"
                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              )}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Naming</span>
            </Link>
          )}
          {user?.name === "Oskar" && (
            <Link
              href="/upload"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                location === "/upload"
                  ? "bg-primary text-primary-foreground"
                  : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              )}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </Link>
          )}
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
        <div className="sm:hidden border-b bg-card px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
          {user?.name === "Philip" && (
            <Link
              href="/selection"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === "/selection"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <MousePointerClick className="w-4 h-4" />
              Selection
            </Link>
          )}
          {user?.name === "Smitz" && (
            <Link
              href="/retouch"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === "/retouch"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Paintbrush className="w-4 h-4" />
              Retouch
            </Link>
          )}
          {(user?.name === "Oskar" || user?.name === "Agnes") && (
            <Link
              href="/naming"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === "/naming"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <FileText className="w-4 h-4" />
              Naming
            </Link>
          )}
          {user?.name === "Oskar" && (
            <Link
              href="/upload"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === "/upload"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Upload className="w-4 h-4" />
              Upload
            </Link>
          )}
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6 fade-in">
        {children}
      </main>
    </div>
  );
}
