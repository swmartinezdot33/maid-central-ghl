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
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: any;
}

export default function CustomersPage() {
  const router = useRouter();
  const { ghlData } = useGHLIframe();
  const [lookupId, setLookupId] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
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
      setFoundCustomer(null);

      let url = `/api/maid-central/customers/${lookupId}?locationId=${ghlData.locationId}`;
      if (lookupId.includes('@')) {
        url = `/api/maid-central/customers?search=${encodeURIComponent(lookupId)}&locationId=${ghlData.locationId}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.customer) {
        setFoundCustomer(data.customer);
        setMessage({ type: 'success', text: 'Customer found!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Customer not found' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to lookup customer' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!foundCustomer) return;

    try {
      setSyncing(true);
      setMessage(null);

      const response = await fetch('/api/sync/customer-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: foundCustomer.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Customer synced successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync customer' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to sync customer' });
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
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Look up and sync customers from MaidCentral</p>
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
              label="Customer ID or Email"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Enter customer ID or email address"
              helperText="Enter a customer ID or email to search for a customer"
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
                  Search Customer
                </>
              )}
            </Button>
          </form>
        </Card>

        {foundCustomer && (
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
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
              {foundCustomer.name && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="text-base text-gray-900 mt-1">{foundCustomer.name}</p>
                </div>
              )}
              {foundCustomer.email && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base text-gray-900 mt-1">{foundCustomer.email}</p>
                </div>
              )}
              {foundCustomer.phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-base text-gray-900 mt-1">{foundCustomer.phone}</p>
                </div>
              )}
              {foundCustomer.address && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="text-base text-gray-900 mt-1">{foundCustomer.address}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Customer ID</p>
                <p className="text-base text-gray-900 mt-1 font-mono text-sm">{foundCustomer.id}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </LocationGuard>
  );
}
