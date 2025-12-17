'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadQuotes();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setQuotes(allQuotes);
      return;
    }

    const searchLower = searchQuery.toLowerCase();
    const filtered = allQuotes.filter((quote) => {
      const quoteNumber = String(quote.quoteNumber || quote.id || '').toLowerCase();
      const customerName = (quote.customerName || '').toLowerCase();
      const customerEmail = (quote.customerEmail || '').toLowerCase();
      const customerPhone = (quote.customerPhone || '').toLowerCase();
      const status = (quote.status || '').toLowerCase();
      
      return quoteNumber.includes(searchLower) || 
             customerName.includes(searchLower) || 
             customerEmail.includes(searchLower) ||
             customerPhone.includes(searchLower) ||
             status.includes(searchLower);
    });
    
    setQuotes(filtered);
  }, [searchQuery, allQuotes]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const response = await fetch('/api/maid-central/quotes');
      const data = await response.json();

      if (response.ok) {
        const quoteArray = Array.isArray(data) ? data : (data.data || data.quotes || []);
        setAllQuotes(quoteArray);
        setQuotes(quoteArray);
        
        if (quoteArray.length === 0) {
          setMessage({ 
            type: 'error', 
            text: 'No quotes found. The Maid Central API /quotes endpoint may not exist. Please check the API documentation for the correct endpoint.' 
          });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load quotes' });
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
      setMessage({ type: 'error', text: 'Failed to load quotes. Please check your Maid Central credentials and API endpoints.' });
      setAllQuotes([]);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  const syncQuoteToGHL = async (quoteId: string | number) => {
    setSyncing(prev => ({ ...prev, [String(quoteId)]: true }));
    setMessage(null);

    try {
      const response = await fetch('/api/webhook/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Quote ${quoteId} synced to GoHighLevel successfully! Contact ID: ${data.contactId || 'N/A'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Failed to sync quote to GHL' });
      }
    } catch (error) {
      console.error('Error syncing quote:', error);
      setMessage({ type: 'error', text: 'Failed to sync quote to GHL' });
    } finally {
      setSyncing(prev => ({ ...prev, [String(quoteId)]: false }));
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Maid Central Quotes</h1>
        <p>View and manually sync quotes to GoHighLevel</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Quotes ({quotes.length} of {allQuotes.length} matching)</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={loadQuotes} className="btn btn-secondary btn-small">
              Refresh
            </button>
            <Link href="/" className="btn btn-secondary btn-small">
              ← Back to Home
            </Link>
          </div>
        </div>

        <div className="mb-2" style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Search by quote number, customer name, email, phone, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button 
            type="button" 
            onClick={() => { 
              setSearchQuery(''); 
              setQuotes(allQuotes);
            }} 
            className="btn"
            disabled={!searchQuery}
          >
            Clear
          </button>
        </div>

        {loading ? (
          <p>Loading quotes...</p>
        ) : quotes.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No quotes found matching your search.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Quote #</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Customer</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Phone</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {quote.quoteNumber || quote.id}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{quote.customerName || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{quote.customerEmail || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{quote.customerPhone || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {quote.totalAmount ? `$${Number(quote.totalAmount).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px',
                        backgroundColor: quote.status === 'approved' ? '#d4edda' : '#fff3cd',
                        color: quote.status === 'approved' ? '#155724' : '#856404',
                        fontSize: '0.85rem'
                      }}>
                        {quote.status || 'unknown'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        onClick={() => syncQuoteToGHL(quote.id)}
                        disabled={syncing[String(quote.id)]}
                        className="btn btn-primary btn-small"
                        style={{ 
                          fontSize: '0.85rem',
                          padding: '0.4rem 0.8rem',
                          backgroundColor: syncing[String(quote.id)] ? '#999' : '#2563eb'
                        }}
                      >
                        {syncing[String(quote.id)] ? 'Syncing...' : 'Sync to GHL'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

