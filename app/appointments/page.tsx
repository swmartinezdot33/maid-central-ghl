'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AppointmentSync {
  id?: number;
  maidCentralAppointmentId?: string;
  ghlAppointmentId?: string;
  ghlCalendarId?: string;
  maidCentralLastModified?: Date;
  ghlLastModified?: Date;
  syncDirection?: 'mc_to_ghl' | 'ghl_to_mc' | 'bidirectional';
  conflictResolution?: 'maid_central_wins' | 'ghl_wins' | 'timestamp';
  createdAt?: Date;
  updatedAt?: Date;
}

interface SyncStatus {
  enabled: boolean;
  totalSynced: number;
  lastSync: Date | null;
  calendarId?: string;
  conflictResolution?: string;
  syncInterval?: number;
}

interface MaidCentralAppointment {
  Id?: string | number;
  AppointmentId?: string | number;
  LeadId?: string | number;
  QuoteId?: string | number;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  ServiceDate?: string;
  ScheduledStart?: string;
  ScheduledEnd?: string;
  Status?: string;
  StatusName?: string;
  ServiceAddress?: string;
  [key: string]: any;
}

export default function AppointmentsPage() {
  const [syncs, setSyncs] = useState<AppointmentSync[]>([]);
  const [mcAppointments, setMcAppointments] = useState<MaidCentralAppointment[]>([]);
  const [ghlAppointments, setGhlAppointments] = useState<any[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingGhlAppointments, setLoadingGhlAppointments] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingAppointmentId, setSyncingAppointmentId] = useState<string | number | null>(null);

  const [lookupId, setLookupId] = useState('');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [foundAppointment, setFoundAppointment] = useState<MaidCentralAppointment | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load sync status
      const statusResponse = await fetch('/api/sync/appointments/status');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setStatus({
          enabled: statusData.enabled || false,
          totalSynced: statusData.totalSynced || 0,
          lastSync: statusData.lastSync ? new Date(statusData.lastSync) : null,
          calendarId: statusData.calendarId,
          conflictResolution: statusData.conflictResolution,
          syncInterval: statusData.syncInterval,
        });
      }

      // Load synced appointments from database
      // const syncsResponse = await fetch('/api/sync/appointments/status');
      // TODO: Add endpoint to get all syncs when needed
      
      // Load Maid Central appointments
      loadMaidCentralAppointments();
      
      // Load GHL appointments
      loadGhlAppointments();
    } catch (error) {
      console.error('Error loading appointment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaidCentralAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const response = await fetch('/api/maid-central/appointments');
      const data = await response.json();
      if (response.ok) {
        setMcAppointments(Array.isArray(data.appointments) ? data.appointments : []);
      } else {
        console.error('Failed to load Maid Central appointments:', data.error);
        setMcAppointments([]);
      }
    } catch (error) {
      console.error('Error loading Maid Central appointments:', error);
      setMcAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const loadGhlAppointments = async () => {
    try {
      setLoadingGhlAppointments(true);
      // Fetch 30 days past and future by default
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString();
      const endDate = new Date(Date.now() + 30 * 86400000).toISOString();
      
      const response = await fetch(`/api/ghl/appointments?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      
      if (response.ok) {
        setGhlAppointments(Array.isArray(data.appointments) ? data.appointments : []);
      } else {
        console.error('Failed to load GHL appointments:', data.error);
        setGhlAppointments([]);
      }
    } catch (error) {
      console.error('Error loading GHL appointments:', error);
      setGhlAppointments([]);
    } finally {
      setLoadingGhlAppointments(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;

    try {
      setLoadingAppointments(true);
      setMessage(null);
      setFoundAppointment(null);

      // Try to find by lead ID
      const response = await fetch(`/api/maid-central/customers/${lookupId}`);
      
      if (response.ok) {
        const data = await response.json();
        // The API might return different structures depending on implementation
        // Check for lead object or direct data
        const record = data.lead || data;
        
        // Ensure we have something that looks like a record
        if (record && (record.LeadId || record.id || record.Id)) {
          // Normalize fields for display if necessary
          const normalized: MaidCentralAppointment = {
            Id: record.LeadId || record.id || record.Id,
            FirstName: record.FirstName || record.firstName,
            LastName: record.LastName || record.lastName,
            Status: record.StatusName || record.status || 'Unknown',
            ServiceDate: record.NextJobDate || record.serviceDate,
            ...record
          };
          setFoundAppointment(normalized);
          setMessage({ type: 'success', text: 'Record found!' });
        } else {
          setMessage({ type: 'error', text: 'No record found with that ID.' });
        }
      } else {
        setMessage({ type: 'error', text: 'Failed to find record. Please verify the ID.' });
      }
    } catch (error) {
      console.error('Error lookup:', error);
      setMessage({ type: 'error', text: 'An error occurred during lookup.' });
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleSyncAppointment = async (appointmentId: string | number) => {
    try {
      setSyncingAppointmentId(appointmentId);
      const response = await fetch('/api/sync/appointments?action=mc-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(`Appointment synced successfully! Action: ${data.action}`);
        loadData(); // Reload to refresh sync status
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing appointment:', error);
      alert('Failed to sync appointment');
    } finally {
      setSyncingAppointmentId(null);
    }
  };

  const handleFullSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/sync/appointments?action=full', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        alert(`Sync completed! ${data.synced || 0} appointments synced, ${data.errors || 0} errors.`);
        loadData(); // Reload data
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing appointments:', error);
      alert('Failed to sync appointments');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Appointment Sync</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Appointment Sync</h1>
        <p>Manage synchronized appointments between Maid Central and GoHighLevel</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" className="btn" style={{ backgroundColor: '#e0e0e0' }}>
          ← Back to Home
        </Link>
      </div>

      <div className="section">
        <h2 className="section-title">Sync Status</h2>
        
        {status && (
          <div style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong>Status:</strong> {status.enabled ? 'Enabled' : 'Disabled'}
              </div>
              <div>
                <strong>Total Synced:</strong> {status.totalSynced}
              </div>
              <div>
                <strong>Last Sync:</strong> {status.lastSync ? status.lastSync.toLocaleString() : 'Never'}
              </div>
              {status.calendarId && (
                <div>
                  <strong>Calendar ID:</strong> {status.calendarId}
                </div>
              )}
              {status.conflictResolution && (
                <div>
                  <strong>Conflict Resolution:</strong> {status.conflictResolution}
                </div>
              )}
              {status.syncInterval && (
                <div>
                  <strong>Sync Interval:</strong> {status.syncInterval} minutes
                </div>
              )}
            </div>
          </div>
        )}

        {status && status.enabled && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={handleFullSync}
              disabled={syncing}
              className="btn btn-primary"
              style={{ backgroundColor: '#2563eb', color: 'white' }}
            >
              {syncing ? 'Syncing...' : 'Sync All Appointments Now'}
            </button>
          </div>
        )}

        {status && !status.enabled && (
          <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            <p style={{ margin: 0 }}>
              Appointment syncing is disabled. Enable it in{' '}
              <Link href="/settings" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                Settings
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title">GoHighLevel Appointments</h2>
          <button
            onClick={loadGhlAppointments}
            disabled={loadingGhlAppointments}
            className="btn"
            style={{ backgroundColor: '#e0e0e0', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
          >
            {loadingGhlAppointments ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {loadingGhlAppointments ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>Loading GHL appointments...</p>
          </div>
        ) : ghlAppointments.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>No appointments found in the selected GoHighLevel calendar.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Ensure you have selected the correct calendar in Settings and that it has appointments within +/- 30 days.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Title</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Start Time</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ghlAppointments.map((appointment) => {
                  const startTime = appointment.startTime || appointment.start || 'N/A';
                  const title = appointment.title || appointment.name || 'Untitled';
                  const status = appointment.status || 'N/A';
                  
                  return (
                    <tr key={appointment.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.75rem' }}>{appointment.id}</td>
                      <td style={{ padding: '0.75rem' }}>{title}</td>
                      <td style={{ padding: '0.75rem' }}>{new Date(startTime).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem' }}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Maid Central Appointments</h2>
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          Search for a Maid Central appointment/lead by ID to sync to GoHighLevel.
        </p>

        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="lookupId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Maid Central Lead/Booking ID
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
            disabled={loadingAppointments || !lookupId.trim()}
            className="btn btn-primary"
            style={{ height: '46px', backgroundColor: '#2563eb', color: 'white' }}
          >
            {loadingAppointments ? 'Searching...' : 'Find Record'}
          </button>
        </form>

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

        {foundAppointment && (
          <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#f9fafb', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Record Details
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Customer</strong>
                <div style={{ fontSize: '1.1rem' }}>{foundAppointment.FirstName} {foundAppointment.LastName}</div>
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
                  {foundAppointment.Status || 'Unknown'}
                </span>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>Service Date</strong>
                <div>{foundAppointment.ServiceDate ? new Date(foundAppointment.ServiceDate).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div>
                <strong style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>ID</strong>
                <div style={{ fontFamily: 'monospace' }}>{foundAppointment.Id}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSyncAppointment}
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
      </div>

      <div className="section">
        <h2 className="section-title">Synced Appointments History</h2>
        
        {syncs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>No synced appointments yet.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Sync appointments using the "Sync to GHL" button above, or use "Sync All Appointments Now" to sync all at once.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>MC Appointment ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>GHL Appointment ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Direction</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {syncs.map((sync) => (
                  <tr key={sync.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem' }}>{sync.maidCentralAppointmentId || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{sync.ghlAppointmentId || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{sync.syncDirection || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {sync.updatedAt ? new Date(sync.updatedAt).toLocaleString() : '-'}
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

