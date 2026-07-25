"use client";

import { brandConfig } from "@lozzi/domain";
import { LozziCrest } from "@lozzi/ui";
import {
  BookOpen,
  CircleGauge,
  FileBadge,
  GraduationCap,
  LogOut,
  Menu,
  Settings,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const navigation = [
  { href: "/student", label: "Overview", icon: CircleGauge },
  { href: "/student/record", label: "Academic record", icon: FileBadge },
  { href: "/student/progress", label: "Degree progress", icon: GraduationCap },
  { href: "/student/shares", label: "Verified shares", icon: Share2 },
  { href: "/student/settings", label: "Settings", icon: Settings },
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
    <nav aria-label="Student navigation" className="space-y-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/student" ? pathname === href : pathname.startsWith(href);
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
                  : "text-white/65 hover:bg-white/5 hover:text-white",
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

export function StudentShell({
  children,
  displayName,
  initials,
  institutionName,
}: {
  readonly children: React.ReactNode;
  readonly displayName: string;
  readonly initials: string;
  readonly institutionName: string;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-lozzi-navy fixed inset-y-0 left-0 z-30 hidden w-60 flex-col text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <LozziCrest className="text-lozzi-navy h-11 w-10 drop-shadow-[0_0_0.5px_white]" />
          <div>
            <p className="font-heading text-2xl leading-none font-semibold">
              {brandConfig.name}
            </p>
            <p className="mt-1 text-[10px] tracking-wider text-white/45 uppercase">
              Student portal
            </p>
          </div>
        </div>
        <div className="px-4 py-7">
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.18em] text-white/35 uppercase">
            My academics
          </p>
          <Navigation />
        </div>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <Avatar className="size-9 border border-white/15">
              <AvatarFallback className="bg-lozzi-teal text-xs font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-[11px] text-white/45">
                {institutionName}
              </p>
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

      <div className="lg:col-start-2">
        <header className="bg-background/95 sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-6 lg:h-20 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet
              open={mobileNavigationOpen}
              onOpenChange={setMobileNavigationOpen}
            >
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
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
                </div>
              </SheetContent>
            </Sheet>
            <LozziCrest className="text-lozzi-navy h-9 w-8" />
          </div>
          <div className="hidden lg:block">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
              {institutionName}
            </p>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <BookOpen className="text-lozzi-teal size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Fall 2026</span>
          </div>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
