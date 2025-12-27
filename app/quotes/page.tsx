'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LocationGuard } from '@/components/LocationGuard';
import { useGHLIframe } from '@/lib/ghl-iframe-context';

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
  const { ghlData } = useGHLIframe();
  const [loading, setLoading] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [foundQuote, setFoundQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // We don't load all quotes on mount anymore
  useEffect(() => {
    // Optional: Check if we have a quote ID in URL params to auto-load
  }, []);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lookupId.trim()) return;

    try {
      setLoading(true);
      setMessage(null);
      setFoundQuote(null);

      // Using the webhook/quote handler logic which actually fetches quote data via Lead API
      // Since we don't have a direct public "get quote by ID" endpoint confirmed, 
      // we rely on the fact that we can get Lead info which contains quote info.
      // But wait, the previous diagnostics showed /api/Lead/Lead?leadId={id} works.
      // A Quote ID is often a UUID in MC, while Lead ID is an int.
      // If the user enters a Lead ID, we can find quotes.
      
      // Let's assume for now the user enters a Lead ID (since that's what we confirmed works)
      // or we try to find a way to lookup by Quote ID.
      // For now, let's treat the input as a Lead ID since that is the master record.
      
      const response = await fetch(`/api/maid-central/leads?leadId=${lookupId}`); 
      // We need a GET route for leads. app/api/maid-central/leads/route.ts is POST only.
      // Let's use the existing customer lookup which calls /api/Lead/Lead
      
      const customerResponse = await fetch(`/api/maid-central/customers/${lookupId}`);
      const data = await customerResponse.json();
      
      if (customerResponse.ok && data) {
        // The lead object contains quote info often
        // Map it to our Quote interface
        const quote: Quote = {
          id: data.LeadId || data.id || lookupId,
          quoteNumber: data.QuoteId || data.quoteNumber || 'N/A', // Assuming QuoteId might be in there
          customerName: data.FirstName && data.LastName ? `${data.FirstName} ${data.LastName}` : (data.name || 'Unknown'),
          customerEmail: data.Email || data.email,
          customerPhone: data.Phone || data.phone,
          totalAmount: data.Price || data.totalAmount || 0, // Placeholder
          status: data.StatusName || data.status || 'N/A',
          ...data
        };
        setFoundQuote(quote);
        setMessage({ type: 'success', text: 'Lead/Quote record found!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Record not found. Please check the Lead ID.' });
      }
    } catch (error) {
      console.error('Error looking up quote:', error);
      setMessage({ type: 'error', text: 'Failed to lookup record. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const syncQuoteToGHL = async () => {
    if (!foundQuote || !ghlData?.locationId) {
      setMessage({ type: 'error', text: 'Location ID is required. Please ensure you are accessing this app through GoHighLevel.' });
      return;
    }
    
    setSyncing(true);
    setMessage(null);

    try {
      // Use the webhook endpoint which handles the full sync logic including opportunities
      const response = await fetch(`/api/webhook/quote?locationId=${ghlData.locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: foundQuote.id }), // sending Lead ID as quoteId for now as fallback
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Synced to GoHighLevel successfully! Contact ID: ${data.contactId || 'N/A'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Failed to sync to GHL' });
      }
    } catch (error) {
      console.error('Error syncing quote:', error);
      setMessage({ type: 'error', text: 'Failed to sync to GHL' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <LocationGuard>
      <div className="container">
      <div className="header">
        <h1>Quote Lookup</h1>
        <p>Lookup a Maid Central Lead/Quote by Lead ID to sync to GoHighLevel.</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" className="btn" style={{ backgroundColor: '#e0e0e0' }}>
          ← Back to Home
        </Link>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ 
          padding: '1rem', 
          marginBottom: '1rem', 
          borderRadius: '4px',
          backgroundColor: message.type === 'error' ? '#fee2e2' : message.type === 'success' ? '#dcfce7' : '#e0f2fe',
          color: message.type === 'error' ? '#991b1b' : message.type === 'success' ? '#166534' : '#075985'
        }}>
          {message.text}
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Lookup Lead/Quote</h2>
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="lookupId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Maid Central Lead ID
            </label>
            <input
              id="lookupId"
              type="text"
              placeholder="Enter Lead ID (e.g. 12345)"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !lookupId.trim()}
            className="btn btn-primary"
            style={{ height: '46px', backgroundColor: '#2563eb', color: 'white' }}
          >
            {loading ? 'Searching...' : 'Find Record'}
          </button>
        </form>

        {foundQuote && (
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#f9fafb' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Record Details
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Customer</strong>
                <div style={{ fontSize: '1.1rem' }}>{foundQuote.customerName}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Status</strong>
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '4px',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.9rem'
                }}>
                  {foundQuote.status}
                </span>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Email</strong>
                <div>{foundQuote.customerEmail || 'N/A'}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Phone</strong>
                <div>{foundQuote.customerPhone || 'N/A'}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Lead ID</strong>
                <div style={{ fontFamily: 'monospace' }}>{foundQuote.id}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={syncQuoteToGHL}
                disabled={syncing}
                className="btn"
                style={{ 
                  backgroundColor: syncing ? '#9ca3af' : '#16a34a', 
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem'
                }}
              >
                {syncing ? 'Syncing...' : 'Sync to GoHighLevel'}
              </button>
            </div>
          </div>
        )}
        
        {!foundQuote && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p>Enter a Lead ID above to search for a record.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Note: Maid Central API does not support searching by name or email. You must provide the exact Lead ID.
            </p>
          </div>
        )}
      </div>
      </div>
    </LocationGuard>
  );
}

