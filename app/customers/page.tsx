'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LocationGuard } from '@/components/LocationGuard';
import { useGHLIframe } from '@/lib/ghl-iframe-context';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: any;
}

export default function CustomersPage() {
  const { ghlData } = useGHLIframe();
  const [loading, setLoading] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // We don't load all customers on mount anymore
  useEffect(() => {
    // Optional: Check if we have a customer ID in URL params to auto-load
    // const params = new URLSearchParams(window.location.search);
    // const id = params.get('id');
    // if (id) handleLookup(id);
  }, []);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lookupId.trim()) return;

    try {
      setLoading(true);
      setMessage(null);
      setFoundCustomer(null);

      // Using the Lead endpoint which returns customer info
      // Since we don't have a direct /customers/{id} endpoint confirmed working other than via Lead
      // We'll try our internal API which wraps the logic
      // If it looks like an email, use the search param
      let url = `/api/maid-central/customers/${lookupId}`;
      if (lookupId.includes('@')) {
        url = `/api/maid-central/customers?search=${encodeURIComponent(lookupId)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok && data) {
        // Normalize data structure
        // If searching by email, it returns an array
        const customer = Array.isArray(data) ? data[0] : data;
        
        if (!customer) {
           setMessage({ type: 'error', text: 'Customer not found. Please check the email or ID.' });
           return;
        }

        setFoundCustomer({
          id: customer.LeadId || customer.id || lookupId,
          name: customer.FirstName && customer.LastName ? `${customer.FirstName} ${customer.LastName}` : (customer.name || 'Unknown'),
          email: customer.Email || customer.email,
          phone: customer.Phone || customer.phone,
          address: customer.HomeAddress1 || customer.address,
          ...customer
        });
        setMessage({ type: 'success', text: 'Customer found!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Customer not found. Please check the ID or Email.' });
      }
    } catch (error) {
      console.error('Error looking up customer:', error);
      setMessage({ type: 'error', text: 'Failed to lookup customer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const syncCustomerToGHL = async () => {
    if (!foundCustomer || !ghlData?.locationId) {
      setMessage({ type: 'error', text: 'Location ID is required. Please ensure you are accessing this app through GoHighLevel.' });
      return;
    }
    
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/sync/customer-to-ghl?locationId=${ghlData.locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: foundCustomer.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Customer synced to GoHighLevel successfully! Contact ID: ${data.contactId || 'N/A'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync customer to GHL' });
      }
    } catch (error) {
      console.error('Error syncing customer:', error);
      setMessage({ type: 'error', text: 'Failed to sync customer to GHL' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <LocationGuard>
      <div className="container">
      <div className="header">
        <h1>Customer Lookup</h1>
        <p>Lookup a Maid Central customer by Lead ID to view or sync to GoHighLevel.</p>
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
        <h2 className="section-title">Lookup Customer</h2>
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="lookupId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Find by Email or Lead ID
            </label>
            <input
              id="lookupId"
              type="text"
              placeholder="Enter Email Address or Lead ID"
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
            {loading ? 'Searching...' : 'Find Customer'}
          </button>
        </form>

        {foundCustomer && (
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#f9fafb' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Customer Details
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Name</strong>
                <div style={{ fontSize: '1.1rem' }}>{foundCustomer.name}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Email</strong>
                <div>{foundCustomer.email || 'N/A'}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Phone</strong>
                <div>{foundCustomer.phone || 'N/A'}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Lead ID</strong>
                <div style={{ fontFamily: 'monospace' }}>{foundCustomer.id}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Address</strong>
                <div>{foundCustomer.address || 'N/A'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={syncCustomerToGHL}
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
        
        {!foundCustomer && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p>Enter an Email Address or Lead ID above to find a customer.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Note: Searching by email will attempt to find an existing customer in Maid Central.
            </p>
          </div>
        )}
      </div>
      </div>
    </LocationGuard>
  );
}

