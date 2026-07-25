"use client";

import { brandConfig } from "@lozzi/domain";
import { LozziCrest } from "@lozzi/ui";
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  Mail,
  Menu,
  NotebookTabs,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/auth/actions";
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

const navigation = [
  { href: "/instructor", label: "Sections", icon: BookOpenCheck },
  { href: "/instructor/gradebook", label: "Gradebook", icon: CalendarDays },
  { href: "/instructor/messages", label: "Messages", icon: Mail },
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
    <nav aria-label="Instructor navigation" className="space-y-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/instructor"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium transition-colors",
              active
                ? mobile
                  ? "bg-accent text-accent-foreground"
                  : "border-l-2 border-white bg-white/10 text-white"
                : mobile
                  ? "text-muted-foreground hover:bg-muted"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function InstructorShell({
  children,
  displayName,
  institutionName,
  termName,
}: {
  readonly children: React.ReactNode;
  readonly displayName: string;
  readonly institutionName: string;
  readonly termName: string;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[12.25rem_1fr]">
      <aside className="bg-lozzi-navy fixed inset-y-0 left-0 z-30 hidden w-[12.25rem] flex-col text-white lg:flex">
        <div className="flex min-h-[12.5rem] flex-col items-center justify-center border-b border-white/10 px-5 text-center">
          <LozziCrest className="text-lozzi-navy h-[5.1rem] w-[4.6rem] drop-shadow-[0_0_0.5px_white]" />
          <p className="font-heading mt-2 text-[2.45rem] leading-none font-semibold">
            {brandConfig.name}
          </p>
          <p className="text-lozzi-teal mt-3 text-sm font-medium">
            Instructor workspace
          </p>
        </div>

        <div className="px-3 py-2">
          <Navigation />
        </div>

        <div className="mt-auto border-t border-white/35 p-4">
          <Link
            href="/instructor/settings"
            className="flex items-center gap-3 rounded-sm px-2 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Settings className="size-5" strokeWidth={1.7} aria-hidden="true" />
            Settings
          </Link>
          <form action={signOut} className="mt-1">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start px-2 text-white/55 hover:bg-white/5 hover:text-white"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="bg-background/95 sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b px-4 backdrop-blur sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
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
                    href="/instructor/settings"
                    onClick={() => setMobileNavigationOpen(false)}
                    className="text-muted-foreground hover:bg-muted mt-2 flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium"
                  >
                    <Settings className="size-5" aria-hidden="true" />
                    Settings
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden items-center gap-3 lg:flex">
              <LozziCrest className="text-lozzi-navy h-9 w-8" />
              <p className="font-heading text-lg font-semibold">
                {institutionName}
              </p>
            </div>
            <div className="bg-border hidden h-8 w-px lg:block" />
            <div className="hidden items-center gap-2 text-sm font-semibold lg:flex">
              {termName}
              <ChevronDown className="size-4" aria-hidden="true" />
            </div>
            <div className="bg-border hidden h-8 w-px lg:block" />
            <Badge
              variant="outline"
              className="hidden border-0 bg-transparent px-0 text-xs font-medium lg:inline-flex"
            >
              <span
                className="bg-lozzi-teal mr-2 size-2 rounded-full"
                aria-hidden="true"
              />
              Synthetic Demo
            </Badge>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications, 2 unread"
              className="relative"
            >
              <Bell strokeWidth={1.7} />
              <span className="bg-lozzi-teal absolute top-0 right-0 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold text-white">
                2
              </span>
            </Button>
            <div className="bg-border h-8 w-px" />
            <div className="flex items-center gap-2">
              <NotebookTabs
                className="text-lozzi-slate size-4 sm:hidden"
                aria-hidden="true"
              />
              <p className="hidden text-sm font-semibold sm:block">
                Dr. {displayName}
              </p>
              <ChevronDown className="size-4" aria-hidden="true" />
            </div>
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
