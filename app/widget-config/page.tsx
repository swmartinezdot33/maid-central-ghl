'use client';

import { useEffect, useState } from 'react';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LocationGuard } from '@/components/LocationGuard';
import { WidgetCustomizer } from '@/components/WidgetCustomizer';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

export default function WidgetConfigPage() {
  const { ghlData } = useGHLIframe();
  const [baseUrl, setBaseUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.origin;
      setBaseUrl(url);

      const code = `<iframe 
  src="${url}/widget?locationId=${ghlData?.locationId || ''}" 
  width="100%" 
  height="800" 
  frameborder="0" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"
  allow="clipboard-write"
></iframe>

<!-- Or use a script tag for better integration -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${url}/widget?locationId=${ghlData?.locationId || ''}';
    iframe.width = '100%';
    iframe.height = '800';
    iframe.frameBorder = '0';
    iframe.style.cssText = 'border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);';
    document.getElementById('maidcentral-booking-widget').appendChild(iframe);
  })();
</script>
<div id="maidcentral-booking-widget"></div>`;

      setEmbedCode(code);
    }
  }, [ghlData?.locationId]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    alert('Embed code copied to clipboard!');
  };

  return (
    <LocationGuard>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quote Widget Configuration</h1>
          <p className="text-gray-600 mt-1">Customize and embed the booking widget on your website</p>
        </div>

        {/* Customizer */}
        <WidgetCustomizer locationId={ghlData?.locationId} />

        {/* Embed Code Section */}
        <Card padding="lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Embed Code</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Copy and paste this code into your website to embed the booking widget:
          </p>

          <div
            style={{
              position: 'relative',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <button
              onClick={copyToClipboard}
              className="absolute top-4 right-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Copy Code
            </button>

            <pre
              style={{
                margin: 0,
                overflow: 'auto',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                maxHeight: '400px',
              }}
            >
              <code>{embedCode}</code>
            </pre>
          </div>

          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fff3cd',
              borderRadius: '4px',
              borderLeft: '4px solid #ffc107',
              marginBottom: '1rem',
            }}
          >
            <strong>Note:</strong> Make sure your Maid Central credentials and GoHighLevel integration are
            configured in the <Link href="/setup" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Setup
            </Link>{' '}
            page before using this widget.
          </div>
        </Card>

        {/* Preview Section */}
        <Card padding="lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Live Preview</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Preview how the widget will look on your site:
          </p>

          <div
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '1rem',
              backgroundColor: '#f9fafb',
            }}
          >
            {baseUrl && ghlData?.locationId && (
              <iframe
                src={`${baseUrl}/widget?locationId=${ghlData.locationId}`}
                width="100%"
                height="600"
                style={{
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
                title="Booking Widget Preview"
              />
            )}
            {!ghlData?.locationId && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                Location ID not available. Please ensure you are accessing this page through the GHL app.
              </div>
            )}
          </div>
        </Card>

        {/* Features Section */}
        <Card padding="lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Widget Features</h2>
          <ul
            style={{
              marginLeft: '1.5rem',
              color: '#666',
              listStyleType: 'disc',
              lineHeight: '1.8',
            }}
          >
            <li>Multi-step booking flow with customer information collection</li>
            <li>Real-time service selection and pricing calculation</li>
            <li>Automatic availability checking</li>
            <li>Simultaneous creation of data in GHL and MaidCentral</li>
            <li>Customizable colors, fonts, and layout</li>
            <li>Full field visibility control</li>
            <li>Custom CSS support for advanced styling</li>
            <li>Captures UTM parameters from URLs</li>
            <li>Automatic tagging of contacts in GHL</li>
          </ul>
        </Card>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link href="/" className="inline-block px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    </LocationGuard>
  );
}
