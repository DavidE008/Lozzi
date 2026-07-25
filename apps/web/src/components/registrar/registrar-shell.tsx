"use client";

import { brandConfig } from "@lozzi/domain";
import { LozziCrest } from "@lozzi/ui";
import {
  BookOpen,
  CalendarDays,
  FileCheck2,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const primaryNavigation = [
  { href: "/registrar", label: "Overview", icon: LayoutDashboard },
  { href: "/registrar/students", label: "Students", icon: Users },
  { href: "/registrar/catalog", label: "Catalog", icon: BookOpen },
  { href: "/registrar/terms", label: "Terms", icon: CalendarDays },
  { href: "/registrar/sections", label: "Sections", icon: GraduationCap },
  { href: "/registrar/records", label: "Records", icon: FileCheck2 },
  { href: "/registrar/audit", label: "Audit", icon: History },
] as const;

function Navigation({
  mobile = false,
  onNavigate,
}: {
  readonly mobile?: boolean;
  readonly onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Registrar navigation" className="space-y-1">
      {primaryNavigation.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/registrar" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? mobile
                  ? "bg-accent text-accent-foreground"
                  : "before:bg-lozzi-teal bg-white/10 text-white before:-ml-3 before:h-5 before:w-0.5"
                : mobile
                  ? "text-muted-foreground hover:bg-muted"
                  : "text-white/62 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function RegistrarShell({
  children,
  displayName,
  initials,
  institutionName,
  termName,
  roleLabel,
}: {
  readonly children: React.ReactNode;
  readonly displayName: string;
  readonly initials: string;
  readonly institutionName: string;
  readonly termName: string;
  readonly roleLabel: string;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[13.25rem_1fr]">
      <aside className="bg-lozzi-navy fixed inset-y-0 left-0 z-30 hidden w-[13.25rem] flex-col text-white lg:flex">
        <div className="flex h-[4.75rem] items-center gap-3 border-b border-white/10 px-5">
          <LozziCrest className="text-lozzi-navy h-10 w-9 drop-shadow-[0_0_0.5px_white]" />
          <div>
            <p className="font-heading text-2xl leading-none font-semibold">
              {brandConfig.name}
            </p>
            <p className="mt-1 text-[9px] tracking-[0.18em] text-white/42 uppercase">
              Registrar office
            </p>
          </div>
        </div>

        <div className="px-3 py-6">
          <p className="mb-3 px-3 text-[9px] font-semibold tracking-[0.2em] text-white/32 uppercase">
            Administration
          </p>
          <Navigation />
        </div>

        <div className="mt-auto border-t border-white/10 p-3">
          <Link
            href="/registrar/settings"
            className="mb-3 flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-white/62 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Settings className="size-4" aria-hidden="true" />
            Settings
          </Link>
          <div className="mb-3 flex items-center gap-3 border-t border-white/10 px-2 pt-4">
            <Avatar className="size-9 border border-white/15">
              <AvatarFallback className="bg-lozzi-teal text-xs font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-[10px] text-white/42">{roleLabel}</p>
            </div>
          </div>
          <form action={signOut}>
            <Button
              variant="ghost"
              className="w-full justify-start text-white/55 hover:bg-white/5 hover:text-white"
              type="submit"
            >
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="bg-background/95 sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-6 lg:h-[4.75rem] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet
              open={mobileNavigationOpen}
              onOpenChange={setMobileNavigationOpen}
            >
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="font-heading flex items-center gap-3 text-2xl">
                    <LozziCrest className="text-lozzi-navy h-10 w-9" />
                    {brandConfig.name}
                  </SheetTitle>
                  <SheetDescription>{institutionName}</SheetDescription>
                </SheetHeader>
                <div className="px-4">
                  <Navigation
                    mobile
                    onNavigate={() => setMobileNavigationOpen(false)}
                  />
                  <Link
                    href="/registrar/settings"
                    onClick={() => setMobileNavigationOpen(false)}
                    className="text-muted-foreground hover:bg-muted mt-2 flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium"
                  >
                    <Settings className="size-4" aria-hidden="true" />
                    Settings
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
            <LozziCrest className="text-lozzi-navy h-9 w-8 lg:hidden" />
            <div className="hidden min-w-0 lg:block">
              <p className="text-lozzi-slate truncate text-xs font-semibold tracking-[0.13em] uppercase">
                {institutionName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
              <CalendarDays
                className="text-lozzi-teal size-4"
                aria-hidden="true"
              />
              {termName}
            </div>
            <Badge
              variant="outline"
              className="border-lozzi-gold/30 bg-lozzi-gold/5 text-lozzi-slate hidden text-[10px] tracking-wider uppercase md:inline-flex"
            >
              Synthetic demo
            </Badge>
            <div className="flex items-center gap-2 border-l pl-3 sm:pl-5">
              <Avatar className="size-8">
                <AvatarFallback className="bg-lozzi-navy text-[10px] font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold">{displayName}</p>
                <p className="text-muted-foreground text-[10px]">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
