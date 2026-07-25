"use client";

import { brandConfig } from "@lozzi/domain";
import { LozziCrest } from "@lozzi/ui";
import {
  Bell,
  ChevronDown,
  ClipboardCheck,
  Menu,
  UserRoundCheck,
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

function AdvisorNavigation({
  mobile = false,
  onNavigate,
}: {
  readonly mobile?: boolean;
  readonly onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === "/advisor";
  return (
    <nav aria-label="Advisor navigation">
      <Link
        href="/advisor"
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
        <ClipboardCheck className="size-5" aria-hidden="true" />
        Degree-plan review
      </Link>
    </nav>
  );
}

export function AdvisorShell({
  children,
  displayName,
  institutionName,
}: {
  readonly children: React.ReactNode;
  readonly displayName: string;
  readonly institutionName: string;
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
            Advisor workspace
          </p>
        </div>
        <div className="px-3 py-2">
          <AdvisorNavigation />
        </div>
        <form action={signOut} className="mt-auto border-t border-white/35 p-4">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-white/60 hover:bg-white/5 hover:text-white"
          >
            Sign out
          </Button>
        </form>
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
                  <AdvisorNavigation
                    mobile
                    onNavigate={() => setMobileNavigationOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <div className="hidden items-center gap-3 lg:flex">
              <LozziCrest className="text-lozzi-navy h-9 w-8" />
              <p className="font-heading text-lg font-semibold">
                {institutionName}
              </p>
            </div>
            <Badge
              variant="outline"
              className="hidden border-0 bg-transparent px-0 text-xs font-medium sm:inline-flex"
            >
              <span
                className="bg-lozzi-teal mr-2 size-2 rounded-full"
                aria-hidden="true"
              />
              Synthetic Demo
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell aria-hidden="true" />
            </Button>
            <div className="bg-border h-8 w-px" />
            <div className="flex items-center gap-2">
              <UserRoundCheck
                className="text-lozzi-slate size-4"
                aria-hidden="true"
              />
              <p className="hidden text-sm font-semibold sm:block">
                {displayName}
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
