'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  Cog6ToothIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CalendarIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Setup', href: '/setup', icon: WrenchScrewdriverIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  { name: 'Customers', href: '/customers', icon: UserGroupIcon },
  { name: 'Quotes', href: '/quotes', icon: DocumentTextIcon },
  { name: 'Appointments', href: '/appointments', icon: CalendarIcon },
  { name: 'Webhooks', href: '/webhooks', icon: ServerIcon },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-center w-16 h-16 relative">
          <Image
            src="/image.png"
            alt="MaidCentral Logo"
            width={64}
            height={64}
            className="object-contain"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900">MaidCentral</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-primary-600' : 'text-gray-400')} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

