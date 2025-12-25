'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function WidgetConfigPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.origin;
      setBaseUrl(url);
      
      const code = `<iframe 
  src="${url}/widget" 
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
    iframe.src = '${url}/widget';
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
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    alert('Embed code copied to clipboard!');
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Booking Widget Configuration</h1>
        <p>Get embed code for your Maid Central online booking widget</p>
      </div>

      <div className="section">
        <h2 className="section-title">Embed Code</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Copy and paste this code into your website to embed the booking widget:
        </p>
        
        <div style={{ 
          position: 'relative',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <button
            onClick={copyToClipboard}
            className="btn btn-primary"
            style={{ 
              position: 'absolute', 
              top: '1rem', 
              right: '1rem',
              fontSize: '0.85rem',
              padding: '0.5rem 1rem'
            }}
          >
            Copy Code
          </button>
          
          <pre style={{ 
            margin: 0, 
            overflow: 'auto',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            maxHeight: '400px'
          }}>
            <code>{embedCode}</code>
          </pre>
        </div>

        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff3cd', 
          borderRadius: '4px',
          borderLeft: '4px solid #ffc107',
          marginBottom: '1rem'
        }}>
          <strong>Note:</strong> Make sure your Maid Central credentials and GoHighLevel integration are configured 
          in the <Link href="/setup" style={{ color: '#2563eb', textDecoration: 'underline' }}>Setup</Link> page 
          before using this widget.
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Preview</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Preview how the widget will look on your site:
        </p>
        
        <div style={{ 
          border: '2px dashed #d1d5db',
          borderRadius: '8px',
          padding: '1rem',
          backgroundColor: '#f9fafb'
        }}>
          <iframe
            src={`${baseUrl}/widget`}
            width="100%"
            height="600"
            style={{ 
              border: 'none', 
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
            title="Booking Widget Preview"
          />
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Customization</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          The widget automatically:
        </p>
        <ul style={{ marginLeft: '1.5rem', color: '#666' }}>
          <li>Captures UTM parameters from the URL (utm_source, utm_medium, utm_campaign)</li>
          <li>Creates leads, quotes, and bookings in Maid Central</li>
          <li>Syncs quote data to GoHighLevel when booking is confirmed</li>
          <li>Adds configured tags to contacts in GoHighLevel</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link href="/" className="btn btn-secondary">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}








