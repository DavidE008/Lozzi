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

function Navigation({ mobile = false }: { readonly mobile?: boolean }) {
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? mobile
                  ? "bg-accent text-accent-foreground"
                  : "bg-white/10 text-white before:-ml-3 before:h-5 before:w-0.5 before:bg-lozzi-teal"
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
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-lozzi-navy text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <LozziCrest className="h-11 w-10 text-lozzi-navy drop-shadow-[0_0_0.5px_white]" />
          <div>
            <p className="font-heading text-2xl font-semibold leading-none">{brandConfig.name}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">Student portal</p>
          </div>
        </div>
        <div className="px-4 py-7">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
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
              <p className="truncate text-[11px] text-white/45">{institutionName}</p>
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:h-20 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}>
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3 font-heading text-2xl">
                    <LozziCrest className="h-10 w-9 text-lozzi-navy" />
                    {brandConfig.name}
                  </SheetTitle>
                  <SheetDescription>{institutionName}</SheetDescription>
                </SheetHeader>
                <div className="px-4">
                  <Navigation mobile />
                </div>
              </SheetContent>
            </Sheet>
            <LozziCrest className="h-9 w-8 text-lozzi-navy" />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {institutionName}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4 text-lozzi-teal" aria-hidden="true" />
            <span className="hidden sm:inline">Fall 2026</span>
          </div>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
