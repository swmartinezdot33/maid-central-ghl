'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LocationGuard } from '@/components/LocationGuard';

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
  const [oauthStatus, setOauthStatus] = useState<{ installed: boolean; locationId?: string; isExpired?: boolean } | null>(null);
  const [loadingOAuth, setLoadingOAuth] = useState(true);
  const { ghlData } = useGHLIframe();

  useEffect(() => {
    fetchCredentials();
    fetchOAuthStatus();
    
    // Check for OAuth success/error messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success === 'oauth_installed') {
      setMessage({ type: 'success', text: 'OAuth installation successful! The app is now connected to your GoHighLevel location.' });
      fetchOAuthStatus();
    } else if (error) {
      setMessage({ type: 'error', text: `OAuth error: ${decodeURIComponent(error)}` });
    }
  }, [searchParams]);

  const fetchCredentials = async () => {
    if (!ghlData?.locationId) {
      console.warn('[Setup] Cannot fetch credentials without locationId');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/maid-central/credentials?locationId=${ghlData.locationId}`);
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

  const fetchOAuthStatus = async () => {
    try {
      setLoadingOAuth(true);
      // Use locationId from iframe context if available
      const locationId = ghlData?.locationId || searchParams.get('locationId');
      if (!locationId) {
        setOauthStatus({ installed: false });
        setLoadingOAuth(false);
        return;
      }
      
      const response = await fetch(`/api/auth/oauth/status?locationId=${locationId}`);
      const data = await response.json();
      setOauthStatus(data);
    } catch (error) {
      console.error('Error fetching OAuth status:', error);
      setOauthStatus({ installed: false });
    } finally {
      setLoadingOAuth(false);
    }
  };

  const handleOAuthInstall = () => {
    const locationId = ghlData?.locationId || searchParams.get('locationId');
    
    // Build OAuth authorize URL with locationId (optional hint)
    // OAuth is always installed via marketplace or direct link, not from custom menu links
    const authUrl = new URL('/api/auth/oauth/authorize', window.location.origin);
    if (locationId) {
      authUrl.searchParams.set('locationId', locationId);
    }
    
    console.log('[Setup] Initiating OAuth installation for locationId:', locationId);
    window.location.href = authUrl.toString();
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ghlData?.locationId) {
      setMessage({ type: 'error', text: 'Location ID is required. Please ensure you are accessing this app through GoHighLevel.' });
      return;
    }
    
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/maid-central/credentials?locationId=${ghlData.locationId}`, {
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


  return (
    <LocationGuard>
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

      {/* GoHighLevel OAuth Installation (Marketplace App) */}
      <div className="section">
        <h2 className="section-title">GoHighLevel Marketplace App (OAuth)</h2>
        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          Install the app via OAuth for secure, per-location authentication. This is the recommended method for marketplace apps and enables user context features.
        </p>
        
        {loadingOAuth ? (
          <p>Checking installation status...</p>
        ) : oauthStatus?.installed ? (
          <div className="mb-2">
            <span className="status-badge success">✓ App Installed</span>
            {oauthStatus.locationId && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                Location ID: {oauthStatus.locationId}
              </p>
            )}
            {oauthStatus.isExpired && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#856404' }}>
                ⚠ Token expired. Please reinstall the app.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-2">
            <span className="status-badge" style={{ backgroundColor: '#ffc107', color: '#856404' }}>
              App Not Installed
            </span>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              Click below to install the app via OAuth for your location.
            </p>
          </div>
        )}
        
        <button 
          type="button" 
          onClick={handleOAuthInstall}
          className="btn"
          style={{ 
            backgroundColor: oauthStatus?.installed ? '#6c757d' : '#007bff',
            color: 'white',
            marginBottom: '1rem'
          }}
        >
          {oauthStatus?.installed ? 'Reinstall App' : 'Install via OAuth'}
        </button>
        
        {ghlData?.locationId && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            Current Location from iframe: <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px' }}>{ghlData.locationId}</code>
          </p>
        )}
      </div>


      <div className="section">
        <button onClick={() => router.push('/')} className="btn" style={{ backgroundColor: '#e0e0e0' }}>
          ← Back to Home
        </button>
      </div>
      </div>
    </LocationGuard>
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

