'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface CredentialsStatus {
  credentials: {
    username: string;
    hasPassword: boolean;
    hasToken: boolean;
  } | null;
}

function SetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mcCredentials, setMcCredentials] = useState<CredentialsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ghlToken, setGhlToken] = useState<{ hasToken: boolean; locationId?: string } | null>(null);
  const [ghlPrivateToken, setGhlPrivateToken] = useState('');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [savingGHL, setSavingGHL] = useState(false);

  useEffect(() => {
    fetchCredentials();
    fetchGHLToken();
  }, [searchParams]);

  const fetchCredentials = async () => {
    try {
      const response = await fetch('/api/maid-central/credentials');
      const data = await response.json();
      setMcCredentials(data);
      if (data.credentials?.username) {
        setUsername(data.credentials.username);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGHLToken = async () => {
    try {
      const response = await fetch('/api/ghl/token');
      const data = await response.json();
      setGhlToken(data.token);
      if (data.token?.locationId) {
        setGhlLocationId(data.token.locationId);
      }
    } catch (error) {
      console.error('Error fetching GHL token:', error);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/maid-central/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage({ 
          type: data.warning ? 'info' : 'success', 
          text: data.message || 'Credentials saved successfully!' 
        });
        await fetchCredentials();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save credentials' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save credentials' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGHLToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGHL(true);
    setMessage(null);

    try {
      const response = await fetch('/api/ghl/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          privateToken: ghlPrivateToken, 
          locationId: ghlLocationId 
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage({ 
          type: data.warning ? 'info' : 'success', 
          text: data.message || 'GoHighLevel token saved successfully!' 
        });
        setGhlPrivateToken(''); // Clear the input for security
        await fetchGHLToken();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save token' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save token' });
    } finally {
      setSavingGHL(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Setup & Configuration</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Setup & Configuration</h1>
        <p>Configure your Maid Central and GoHighLevel integrations</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Maid Central Credentials */}
      <div className="section">
        <h2 className="section-title">Maid Central API Credentials</h2>
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          Get your API credentials from Maid Central: <strong>Company → Settings → General → Integrations Tab → API Users</strong>
        </p>
        
        {mcCredentials?.credentials && (
          <div className="mb-2">
            <span className="status-badge success">Currently configured</span>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              Username: {mcCredentials.credentials.username}
            </p>
          </div>
        )}

        <form onSubmit={handleSaveCredentials}>
          <div className="form-group">
            <label htmlFor="username">API Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your Maid Central API username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">API Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your Maid Central API password"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>
        </form>
      </div>

      {/* GoHighLevel Private Token */}
      <div className="section">
        <h2 className="section-title">GoHighLevel Private Token</h2>
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          Get your private token from GoHighLevel: <strong>Settings → Integrations → API → Private API Token</strong>
          <br />
          Also provide your Location/Subaccount ID where contacts should be created.
        </p>
        
        {ghlToken?.hasToken && (
          <div className="mb-2">
            <span className="status-badge success">Currently configured</span>
            {ghlToken.locationId && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                Location ID: {ghlToken.locationId}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSaveGHLToken}>
          <div className="form-group">
            <label htmlFor="ghlPrivateToken">Private API Token</label>
            <input
              type="password"
              id="ghlPrivateToken"
              value={ghlPrivateToken}
              onChange={(e) => setGhlPrivateToken(e.target.value)}
              required={!ghlToken?.hasToken}
              placeholder="Enter your GoHighLevel private API token"
            />
            <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.85rem' }}>
              <p style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#333' }}>Required Scopes/Permissions:</p>
              <p style={{ marginBottom: '0.5rem', color: '#666' }}>When creating your Private API Token in GoHighLevel, ensure it has the following scopes with <strong style={{ color: '#d32f2f' }}>READ and WRITE</strong> access:</p>
              <ul style={{ marginLeft: '1.5rem', marginBottom: '0.5rem', color: '#666', lineHeight: '1.6' }}>
                <li><strong>Locations:</strong> Read access to fetch location information</li>
                <li><strong>Contacts:</strong> <span style={{ color: '#d32f2f', fontWeight: 600 }}>Read and Write</span> - Required to create contacts and update contact custom fields from Maid Central quotes</li>
                <li><strong>Custom Fields:</strong> Read access to fetch contact, opportunity, and object custom fields for mapping</li>
                <li><strong>Opportunities:</strong> <span style={{ color: '#d32f2f', fontWeight: 600 }}>Read and Write</span> - Required to create/update opportunities and opportunity custom fields</li>
                <li><strong>Objects:</strong> <span style={{ color: '#d32f2f', fontWeight: 600 }}>Read and Write</span> - Required to create/update objects and object custom fields</li>
              </ul>
              <p style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#fff3cd', borderRadius: '3px', fontSize: '0.85rem', color: '#856404' }}>
                <strong>Important:</strong> Write permissions are required so that quote data from Maid Central can be synced to your GoHighLevel account.
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>
                You can find these settings in: <strong>Settings → Integrations → Private Integrations</strong>
              </p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ghlLocationId">Location/Subaccount ID</label>
            <input
              type="text"
              id="ghlLocationId"
              value={ghlLocationId}
              onChange={(e) => setGhlLocationId(e.target.value)}
              required
              placeholder="Enter your GoHighLevel location/subaccount ID"
            />
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
              You can find this in your GoHighLevel URL or API settings. It's typically in the format: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>TEKiMreVHPe3olIARlmx</code>
            </p>
          </div>

          <button type="submit" className="btn btn-secondary" disabled={savingGHL}>
            {savingGHL ? 'Saving...' : 'Save Token'}
          </button>
        </form>
      </div>

      <div className="section">
        <button onClick={() => router.push('/')} className="btn" style={{ backgroundColor: '#e0e0e0' }}>
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="header">
          <h1>Setup & Configuration</h1>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <SetupPageContent />
    </Suspense>
  );
}

