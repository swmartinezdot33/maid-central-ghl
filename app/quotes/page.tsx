'use client';

import { LocationGuard } from '@/components/LocationGuard';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { QuoteBuilder } from '@/components/QuoteBuilder';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function QuotesPage() {
  const router = useRouter();
  const { ghlData } = useGHLIframe();

  return (
    <LocationGuard>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Quote & Booking</h1>
            <p className="text-gray-600 mt-1">Create a quote and book a service through the dashboard</p>
          </div>
        </div>

        <QuoteBuilder 
          locationId={ghlData?.locationId}
          onSuccess={(result) => {
            alert(`Quote and booking created successfully!\nQuote ID: ${result.quoteId}\nBooking ID: ${result.bookingId}`);
            router.push('/');
          }}
          onError={(error) => {
            console.error('Error:', error);
          }}
        />
      </div>
    </LocationGuard>
  );
}
