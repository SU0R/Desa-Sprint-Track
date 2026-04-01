import Link from 'next/link';
import {
  Activity,
  ArrowRightLeft,
  Gauge,
  Home,
  PanelLeft,
  Timer
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import Providers from './providers';
import { NavItem } from './nav-item';
import { SprintTrackerProvider } from '@/hooks/use-sprint-tracker-store';
import { Badge } from '@/components/ui/badge';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <SprintTrackerProvider>
        <main className="flex min-h-screen w-full flex-col bg-background">
          <DesktopNav />
          <div className="flex min-h-screen flex-col sm:pl-16">
            <header className="sticky top-0 z-30 border-b border-white/5 bg-background/85 backdrop-blur">
              <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
                <MobileNav />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.35em] text-primary">
                    Sprint Tracker
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold text-white">
                      Build speed with clean sessions and believable timing.
                    </h1>
                    <Badge
                      variant="outline"
                      className="border-primary/35 bg-primary/10 text-primary"
                    >
                      Local-first v1
                    </Badge>
                  </div>
                </div>
                <Link href="/sessions/new">
                  <Button className="hidden sm:inline-flex">New Session</Button>
                </Link>
              </div>
            </header>
            <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
          </div>
        </main>
      </SprintTrackerProvider>
    </Providers>
  );
}

function DesktopNav() {
  return (
    <aside className="glass-panel fixed inset-y-0 left-0 z-10 hidden w-16 flex-col border-r border-white/5 sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 py-5">
        <Link
          href="/"
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground"
        >
          <Activity className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="sr-only">Sprint Tracker home</span>
        </Link>

        <NavItem href="/" label="Dashboard">
          <Home className="h-5 w-5" />
        </NavItem>

        <NavItem href="/sessions/new" label="New Session">
          <Gauge className="h-5 w-5" />
        </NavItem>

        <NavItem href="/timer" label="Timer">
          <Timer className="h-5 w-5" />
        </NavItem>

        <NavItem href="/rooms" label="Rooms">
          <ArrowRightLeft className="h-5 w-5" />
        </NavItem>
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/timer"
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <Timer className="h-5 w-5" />
              <span className="sr-only">Open timer prototype</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Timer prototype</TooltipContent>
        </Tooltip>
      </nav>
    </aside>
  );
}

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="border-white/10 bg-white/5 sm:hidden"
        >
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="glass-panel border-white/10 bg-background/95 sm:max-w-xs"
      >
        <nav className="grid gap-6 text-lg font-medium">
          <Link
            href="/"
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground"
          >
            <Activity className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span className="sr-only">Sprint Tracker</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-4 px-2.5 text-foreground"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/sessions/new"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Gauge className="h-5 w-5" />
            New Session
          </Link>
          <Link
            href="/timer"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Timer className="h-5 w-5" />
            Timer
          </Link>
          <Link
            href="/rooms"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowRightLeft className="h-5 w-5" />
            Rooms
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
