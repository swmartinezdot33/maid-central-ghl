'use client';

import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { Badge } from './ui/Badge';

export function Header() {
  const { ghlData } = useGHLIframe();

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Integration Dashboard</h1>
          {ghlData?.locationId && (
            <Badge variant="info" size="sm">
              {ghlData.locationName || ghlData.locationId}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {ghlData?.userName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{ghlData.userName}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

