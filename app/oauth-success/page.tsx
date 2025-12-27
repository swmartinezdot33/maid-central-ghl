'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function OAuthSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [locationId, setLocationId] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const locId = searchParams.get('locationId');

    if (locId) {
      setLocationId(locId);
    }

    if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
    } else if (success === 'oauth_installed') {
      setStatus('success');
      setMessage('OAuth installation successful! The app is now connected to your GoHighLevel location.');
    } else {
      setStatus('success');
      setMessage('OAuth installation completed successfully.');
    }
  }, [searchParams]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {status === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ marginBottom: '1rem' }}>Processing OAuth Installation...</h1>
            <p>Please wait while we complete the installation.</p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '4rem', 
              marginBottom: '1rem',
              color: '#10b981'
            }}>✓</div>
            <h1 style={{ marginBottom: '1rem', color: '#10b981' }}>Installation Successful!</h1>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#666' }}>
              {message}
            </p>
            {locationId && (
              <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#999' }}>
                Location ID: {locationId}
              </p>
            )}
            <div style={{ marginTop: '2rem' }}>
              <Link 
                href="/setup" 
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: '500'
                }}
              >
                Continue to Setup
              </Link>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#999' }}>
              You can now configure your Maid Central credentials and integration settings.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '4rem', 
              marginBottom: '1rem',
              color: '#ef4444'
            }}>✗</div>
            <h1 style={{ marginBottom: '1rem', color: '#ef4444' }}>Installation Failed</h1>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#666' }}>
              {message || 'An error occurred during OAuth installation.'}
            </p>
            
            {message && message.includes('invalid_request') && (
              <div style={{ 
                marginTop: '1.5rem', 
                marginBottom: '1.5rem',
                padding: '1rem', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: '4px',
                textAlign: 'left'
              }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#856404' }}>
                  Common Fix for "invalid_request" Error:
                </strong>
                <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#856404' }}>
                  <li style={{ marginBottom: '0.5rem' }}>Go to your <strong>GHL Marketplace app settings</strong></li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    Verify the <strong>Redirect URI</strong> is EXACTLY:
                    <code style={{ 
                      display: 'block',
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '2px',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }}>
                      https://maidcentral.vercel.app/api/auth/oauth/callback
                    </code>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>It must match <strong>character-for-character</strong> (no trailing slash, exact path)</li>
                  <li style={{ marginBottom: '0.5rem' }}>Save the settings in GHL Marketplace</li>
                  <li>Try installing again</li>
                </ol>
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#856404' }}>
                  <a 
                    href="/api/auth/oauth/test-url" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#0066cc', textDecoration: 'underline' }}
                  >
                    Click here to verify your OAuth configuration
                  </a>
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '2rem' }}>
              <Link 
                href="/setup" 
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: '500',
                  marginRight: '0.5rem'
                }}
              >
                Return to Setup
              </Link>
              <a
                href="/api/auth/oauth/debug"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: '500'
                }}
              >
                Check Configuration
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Loading...</h1>
        </div>
      </div>
    }>
      <OAuthSuccessContent />
    </Suspense>
  );
}

