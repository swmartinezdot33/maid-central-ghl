'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: any;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]); // Store all customers for client-side filtering
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAllCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter customers client-side when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setCustomers(allCustomers);
      return;
    }

    const searchLower = searchQuery.toLowerCase();
    const filtered = allCustomers.filter((customer) => {
      const name = (customer.name || customer.customerName || '').toLowerCase();
      const email = (customer.email || customer.customerEmail || '').toLowerCase();
      const phone = (customer.phone || customer.customerPhone || '').toLowerCase();
      const id = String(customer.id || '').toLowerCase();
      const address = (customer.address || '').toLowerCase();
      
      return name.includes(searchLower) || 
             email.includes(searchLower) || 
             phone.includes(searchLower) ||
             id.includes(searchLower) ||
             address.includes(searchLower);
    });
    
    setCustomers(filtered);
  }, [searchQuery, allCustomers]);

  const loadAllCustomers = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const response = await fetch('/api/maid-central/customers');
      const data = await response.json();
      
      if (response.ok) {
        const customerArray = Array.isArray(data) ? data : (data.data || data.customers || []);
        setAllCustomers(customerArray);
        setCustomers(customerArray);
        
        if (customerArray.length === 0) {
          setMessage({ 
            type: 'error', 
            text: 'No customers found. The Maid Central API /customers endpoint may not exist. Please check the API documentation for the correct endpoint.' 
          });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load customers' });
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      setMessage({ type: 'error', text: 'Failed to load customers. Please check your Maid Central credentials and API endpoints.' });
      setAllCustomers([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled by useEffect, but we can trigger a reload if needed
    if (!searchQuery.trim()) {
      loadAllCustomers();
    }
  };

  const syncCustomerToGHL = async (customerId: string) => {
    setSyncing(prev => ({ ...prev, [customerId]: true }));
    setMessage(null);

    try {
      const response = await fetch('/api/sync/customer-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Customer ${customerId} synced to GoHighLevel successfully! Contact ID: ${data.contactId || 'N/A'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync customer to GHL' });
      }
    } catch (error) {
      console.error('Error syncing customer:', error);
      setMessage({ type: 'error', text: 'Failed to sync customer to GHL' });
    } finally {
      setSyncing(prev => ({ ...prev, [customerId]: false }));
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Maid Central Customers</h1>
        <p>Manage and view your Maid Central customers</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Customers</h2>
          <Link href="/" className="btn" style={{ backgroundColor: '#e0e0e0' }}>
            ← Back to Home
          </Link>
        </div>

        <div className="mb-2" style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Search customers by name, email, phone, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button 
            type="button" 
            onClick={() => { 
              setSearchQuery(''); 
              setCustomers(allCustomers);
            }} 
            className="btn"
            disabled={!searchQuery}
          >
            Clear
          </button>
          <button 
            type="button" 
            onClick={loadAllCustomers} 
            className="btn btn-secondary"
            title="Reload all customers"
          >
            Refresh
          </button>
        </div>
        
        {searchQuery && (
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
            Showing {customers.length} of {allCustomers.length} customers matching "{searchQuery}"
          </p>
        )}

        {loading ? (
          <p>Loading customers...</p>
        ) : customers.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No customers found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Phone</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Address</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem' }}>{customer.name || customer.customerName || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{customer.email || customer.customerEmail || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{customer.phone || customer.customerPhone || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{customer.address || '-'}</td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{customer.id}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        onClick={() => syncCustomerToGHL(customer.id)}
                        disabled={syncing[customer.id]}
                        className="btn btn-primary btn-small"
                        style={{ 
                          fontSize: '0.85rem',
                          padding: '0.4rem 0.8rem',
                          backgroundColor: syncing[customer.id] ? '#999' : '#2563eb'
                        }}
                      >
                        {syncing[customer.id] ? 'Syncing...' : 'Sync to GHL'}
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

