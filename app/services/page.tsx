'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Service {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  [key: string]: any;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/maid-central/services');
      const data = await response.json();
      
      if (response.ok) {
        setServices(Array.isArray(data) ? data : (data.data || data.services || []));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load services' });
      }
    } catch (error) {
      console.error('Error loading services:', error);
      setMessage({ type: 'error', text: 'Failed to load services' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Maid Central Services</h1>
        <p>View your Maid Central service catalog</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Services</h2>
          <Link href="/" className="btn" style={{ backgroundColor: '#e0e0e0' }}>
            ← Back to Home
          </Link>
        </div>

        {loading ? (
          <p>Loading services...</p>
        ) : services.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No services found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {services.map((service) => (
              <div key={service.id} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>{service.name || 'Unnamed Service'}</h3>
                  {service.price !== undefined && (
                    <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
                      ${typeof service.price === 'number' ? service.price.toFixed(2) : service.price}
                    </span>
                  )}
                </div>
                {service.description && (
                  <p style={{ color: '#666', margin: '0.5rem 0' }}>{service.description}</p>
                )}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#666' }}>
                  {service.duration && (
                    <span>Duration: {service.duration} min</span>
                  )}
                  <span style={{ fontFamily: 'monospace' }}>ID: {service.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}









