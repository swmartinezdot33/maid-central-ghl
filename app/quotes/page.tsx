'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationGuard } from '@/components/LocationGuard';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeftIcon, MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Quote {
  id: string | number;
  quoteNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}

export default function QuotesPage() {
  const router = useRouter();
  const { ghlData } = useGHLIframe();
  const [lookupId, setLookupId] = useState('');
  const [foundQuote, setFoundQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lookupId.trim()) return;

    if (!ghlData?.locationId) {
      setMessage({ type: 'error', text: 'Location ID is required. Please ensure you are accessing this app through CRM.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      setFoundQuote(null);

      const response = await fetch(`/api/webhook/quote?quoteId=${encodeURIComponent(lookupId)}&locationId=${ghlData.locationId}`);
      const data = await response.json();

      if (response.ok && data.quote) {
        // Map Maid Central fields to display format
        const rawQuote = data.quote;
        const mappedQuote: Quote = {
          id: rawQuote.LeadId || rawQuote.leadId || rawQuote.Id || rawQuote.id || lookupId,
          quoteNumber: rawQuote.QuoteNumber || rawQuote.quoteNumber || rawQuote.QuoteId || rawQuote.quoteId,
          customerName: rawQuote.FirstName && rawQuote.LastName 
            ? `${rawQuote.FirstName} ${rawQuote.LastName}` 
            : rawQuote.CustomerName || rawQuote.customerName || rawQuote.Name || rawQuote.name,
          customerEmail: rawQuote.Email || rawQuote.email || rawQuote.EmailAddress || rawQuote.emailAddress,
          customerPhone: rawQuote.Phone || rawQuote.phone || rawQuote.PhoneNumber || rawQuote.phoneNumber || rawQuote.Mobile || rawQuote.mobile,
          totalAmount: rawQuote.QuoteTotal || rawQuote.quoteTotal || rawQuote.TotalAmount || rawQuote.totalAmount || rawQuote.Amount || rawQuote.amount,
          status: rawQuote.StatusName || rawQuote.statusName || rawQuote.Status || rawQuote.status,
          createdAt: rawQuote.CreatedDate || rawQuote.createdDate || rawQuote.CreatedAt || rawQuote.createdAt,
          // Include all raw data for debugging
          ...rawQuote,
        };
        setFoundQuote(mappedQuote);
        setMessage({ type: 'success', text: 'Quote found!' });
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Quote not found' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to lookup quote' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!foundQuote) return;

    if (!ghlData?.locationId) {
      setMessage({ type: 'error', text: 'Location ID is required. Please ensure you are accessing this app through CRM.' });
      return;
    }

    try {
      setSyncing(true);
      setMessage(null);

      const response = await fetch(`/api/webhook/quote?quoteId=${foundQuote.id}&locationId=${ghlData.locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteId: foundQuote.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ 
          type: 'success', 
          text: data.message || `Quote synced successfully! Contact ID: ${data.contactId || 'N/A'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Failed to sync quote' });
      }
    } catch (error) {
      console.error('Sync error:', error);
      setMessage({ type: 'error', text: `Failed to sync quote: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <LocationGuard>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="text-gray-600 mt-1">Look up and sync quotes from MaidCentral</p>
          </div>
        </div>

        {message && (
          <Alert
            variant={message.type === 'error' ? 'error' : message.type === 'info' ? 'info' : 'success'}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        <Card padding="lg">
          <form onSubmit={handleLookup} className="space-y-4">
            <Input
              label="Quote ID"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Enter quote ID"
              helperText="Enter a quote ID to search for and sync a quote"
            />
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                  Search Quote
                </>
              )}
            </Button>
          </form>
        </Card>

        {foundQuote && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Quote Details</h2>
              <Button onClick={handleSync} variant="primary" disabled={syncing}>
                {syncing ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Syncing...
                  </>
                ) : (
                  'Sync to CRM'
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Quote ID</p>
                <p className="text-base text-gray-900 mt-1 font-mono text-sm">{foundQuote.id}</p>
              </div>
              {foundQuote.quoteNumber && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Quote Number</p>
                  <p className="text-base text-gray-900 mt-1">{foundQuote.quoteNumber}</p>
                </div>
              )}
              {foundQuote.customerName && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer Name</p>
                  <p className="text-base text-gray-900 mt-1">{foundQuote.customerName}</p>
                </div>
              )}
              {foundQuote.customerEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer Email</p>
                  <p className="text-base text-gray-900 mt-1">{foundQuote.customerEmail}</p>
                </div>
              )}
              {foundQuote.customerPhone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer Phone</p>
                  <p className="text-base text-gray-900 mt-1">{foundQuote.customerPhone}</p>
                </div>
              )}
              {foundQuote.totalAmount && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Amount</p>
                  <p className="text-base text-gray-900 mt-1">${typeof foundQuote.totalAmount === 'number' ? foundQuote.totalAmount.toFixed(2) : foundQuote.totalAmount}</p>
                </div>
              )}
              {foundQuote.status && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge variant="info" className="mt-1">{foundQuote.status}</Badge>
                </div>
              )}
              {foundQuote.createdAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Created Date</p>
                  <p className="text-base text-gray-900 mt-1">{new Date(foundQuote.createdAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
            
            {/* Show raw data for debugging if no mapped fields found */}
            {!foundQuote.quoteNumber && !foundQuote.customerName && !foundQuote.customerEmail && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Raw Quote Data (for debugging):</p>
                <pre className="text-xs text-gray-600 overflow-auto max-h-96">
                  {JSON.stringify(foundQuote, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        )}
      </div>
    </LocationGuard>
  );
}
