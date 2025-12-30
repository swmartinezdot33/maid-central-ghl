'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LocationGuard } from '@/components/LocationGuard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
  CloudIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface CredentialsStatus {
  credentials: {
    username: string;
    hasPassword: boolean;
    hasToken: boolean;
  } | null;
}

function maskCredential(value: string): string {
  if (!value) return '';
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  const first4 = value.substring(0, 4);
  const last4 = value.substring(value.length - 4);
  const middleLength = value.length - 8;
  const stars = '*'.repeat(Math.max(4, middleLength));
  return `${first4}${stars}${last4}`;
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
  const [oauthStatus, setOauthStatus] = useState<{ installed: boolean; locationId?: string; isExpired?: boolean; tokenActuallyWorks?: boolean } | null>(null);
  const [loadingOAuth, setLoadingOAuth] = useState(true);
  const { ghlData } = useGHLIframe();

  useEffect(() => {
    fetchCredentials();
    fetchOAuthStatus();
    
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
    const authUrl = new URL('/api/auth/oauth/authorize', window.location.origin);
    if (locationId) {
      authUrl.searchParams.set('locationId', locationId);
    }
    
    console.log('[Setup] Initiating OAuth installation for locationId:', locationId);
    window.open(authUrl.toString(), '_blank');
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Setup & Configuration</h1>
            <p className="text-gray-600 mt-1">Configure your Maid Central and GoHighLevel integrations</p>
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

        {/* Maid Central Credentials */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 rounded-lg">
              <KeyIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Maid Central API Credentials</h2>
              <p className="text-sm text-gray-500">Get your API credentials from Maid Central</p>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-lg">
            <strong>Where to find:</strong> Company → Settings → General → Integrations Tab → API Users
          </p>
          
          {mcCredentials?.credentials && (
            <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-success-900 mb-1">Credentials Configured</p>
                  <p className="text-xs text-success-700">
                    Username: {maskCredential(mcCredentials.credentials.username)}
                  </p>
                  {mcCredentials.credentials.hasPassword && (
                    <p className="text-xs text-success-700 mt-1">
                      Password: ******** (configured)
                    </p>
                  )}
                </div>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <Input
              label="API Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your Maid Central API username"
            />

            <Input
              label="API Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your Maid Central API password"
            />

            <Button type="submit" variant="primary" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Credentials'
              )}
            </Button>
          </form>
        </Card>

        {/* GoHighLevel OAuth */}
        <Card padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-accent-100 rounded-lg">
              <CloudIcon className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">GoHighLevel Marketplace App (OAuth)</h2>
              <p className="text-sm text-gray-500">Install the app via OAuth for secure authentication</p>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-lg">
            Install the app via OAuth for secure, per-location authentication. This is the recommended method for marketplace apps and enables user context features.
          </p>
          
          {loadingOAuth ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : oauthStatus?.installed ? (
            <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-success-900 mb-1">App Installed</p>
                  {oauthStatus.locationId && (
                    <p className="text-xs text-success-700">
                      Location ID: {oauthStatus.locationId}
                    </p>
                  )}
                  {oauthStatus.isExpired && oauthStatus.tokenActuallyWorks === false && (
                    <p className="text-xs text-warning-700 mt-1">
                      ⚠ Token expired. Please reinstall the app.
                    </p>
                  )}
                </div>
                <Badge variant="success">Connected</Badge>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-warning-900 mb-1">App Not Installed</p>
                  <p className="text-xs text-warning-700">
                    Click below to install the app via OAuth for your location.
                  </p>
                </div>
                <Badge variant="warning">Not Connected</Badge>
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <Button
              onClick={handleOAuthInstall}
              variant={oauthStatus?.installed ? 'secondary' : 'primary'}
              className="flex-1"
            >
              {oauthStatus?.installed ? 'Reinstall App' : 'Install via OAuth'}
            </Button>
            
            {oauthStatus?.installed && (
              <Button
                onClick={async () => {
                  if (!ghlData?.locationId) {
                    setMessage({ type: 'error', text: 'Location ID is required' });
                    return;
                  }
                  
                  if (!confirm('Are you sure you want to clear the OAuth token? You will need to reinstall the app.')) {
                    return;
                  }
                  
                  try {
                    const response = await fetch(`/api/auth/oauth/clear?locationId=${ghlData.locationId}`, {
                      method: 'DELETE',
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                      setMessage({ type: 'success', text: 'OAuth token cleared. Please reinstall the app.' });
                      await fetchOAuthStatus();
                    } else {
                      setMessage({ type: 'error', text: data.error || 'Failed to clear token' });
                    }
                  } catch (error) {
                    setMessage({ type: 'error', text: 'Failed to clear token' });
                  }
                }}
                variant="danger"
              >
                Clear Token
              </Button>
            )}
          </div>
          
          {ghlData?.locationId && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">
                Current Location from iframe: <code className="bg-white px-2 py-1 rounded text-xs">{ghlData.locationId}</code>
              </p>
              <a 
                href={`/api/auth/oauth/diagnose?locationId=${ghlData.locationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:text-primary-700 underline"
              >
                🔍 Diagnose Token Issues
              </a>
            </div>
          )}
        </Card>
      </div>
    </LocationGuard>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <SetupPageContent />
    </Suspense>
  );
}
