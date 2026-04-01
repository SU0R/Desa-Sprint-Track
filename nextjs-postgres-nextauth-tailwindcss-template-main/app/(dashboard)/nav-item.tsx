'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavItem({
  href,
  label,
  children
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground',
            {
              'bg-primary text-black shadow-[0_0_24px_rgba(43,214,122,0.2)]':
                href === '/'
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`)
            }
          )}
        >
          {children}
          <span className="sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
