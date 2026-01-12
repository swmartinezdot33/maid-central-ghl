'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface WidgetCustomizerProps {
  locationId?: string;
  onSuccess?: (config: any) => void;
}

export function WidgetCustomizer({ locationId, onSuccess }: WidgetCustomizerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Theme Colors
  const [themeColors, setThemeColors] = useState({
    primary: '#2563eb',
    secondary: '#059669',
    background: '#ffffff',
    text: '#1f2937',
    textLight: '#6b7280',
    border: '#e5e7eb',
    success: '#10b981',
    error: '#ef4444',
  });

  // Typography
  const [typography, setTypography] = useState({
    fontFamily: 'system-ui, -apple-system, sans-serif',
    heading1Size: '2rem',
    heading2Size: '1.5rem',
    bodySize: '1rem',
    headingWeight: '700',
    bodyWeight: '400',
  });

  // Layout
  const [layout, setLayout] = useState({
    multiStep: true,
    fieldArrangement: 'single-column' as 'single-column' | 'two-column',
    showBranding: true,
    showProgress: true,
  });

  // Custom CSS
  const [customCss, setCustomCss] = useState('');

  // Field Visibility
  const [fieldVisibility, setFieldVisibility] = useState({
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    postalCode: true,
    services: true,
    address: true,
    date: true,
    time: true,
  });

  // Load existing configuration
  useEffect(() => {
    if (!locationId) return;

    const loadConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/widget-config?locationId=${locationId}`);
        if (response.ok) {
          const config = await response.json();
          if (config.themeColors) setThemeColors(config.themeColors);
          if (config.typography) setTypography(config.typography);
          if (config.layout) setLayout(config.layout);
          if (config.customCss) setCustomCss(config.customCss);
          if (config.fieldVisibility) setFieldVisibility(config.fieldVisibility);
        }
      } catch (err) {
        console.error('Error loading widget config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [locationId]);

  const handleSave = async () => {
    if (!locationId) {
      setError('Location ID is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/widget-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ghl-location-id': locationId,
        },
        body: JSON.stringify({
          locationId,
          themeColors,
          typography,
          layout,
          customCss,
          fieldVisibility,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess('Configuration saved successfully!');
        if (onSuccess) {
          onSuccess(result.config);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Theme Colors */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold mb-4">Theme Colors</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(themeColors).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                {key}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={value}
                  onChange={(e) =>
                    setThemeColors({ ...themeColors, [key]: e.target.value })
                  }
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    setThemeColors({ ...themeColors, [key]: e.target.value })
                  }
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Typography */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold mb-4">Typography</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Font Family
            </label>
            <input
              type="text"
              value={typography.fontFamily}
              onChange={(e) =>
                setTypography({ ...typography, fontFamily: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="system-ui, sans-serif"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Input
              label="Heading 1 Size"
              value={typography.heading1Size}
              onChange={(e) =>
                setTypography({ ...typography, heading1Size: e.target.value })
              }
              placeholder="2rem"
            />
            <Input
              label="Heading 2 Size"
              value={typography.heading2Size}
              onChange={(e) =>
                setTypography({ ...typography, heading2Size: e.target.value })
              }
              placeholder="1.5rem"
            />
            <Input
              label="Body Size"
              value={typography.bodySize}
              onChange={(e) =>
                setTypography({ ...typography, bodySize: e.target.value })
              }
              placeholder="1rem"
            />
            <Input
              label="Heading Weight"
              value={typography.headingWeight}
              onChange={(e) =>
                setTypography({ ...typography, headingWeight: e.target.value })
              }
              placeholder="700"
            />
            <Input
              label="Body Weight"
              value={typography.bodyWeight}
              onChange={(e) =>
                setTypography({ ...typography, bodyWeight: e.target.value })
              }
              placeholder="400"
            />
          </div>
        </div>
      </Card>

      {/* Layout */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold mb-4">Layout Options</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={layout.multiStep}
              onChange={(e) => setLayout({ ...layout, multiStep: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Multi-Step Form</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={layout.showBranding}
              onChange={(e) => setLayout({ ...layout, showBranding: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Show Branding</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={layout.showProgress}
              onChange={(e) => setLayout({ ...layout, showProgress: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Show Progress Indicator</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field Arrangement
            </label>
            <select
              value={layout.fieldArrangement}
              onChange={(e) =>
                setLayout({
                  ...layout,
                  fieldArrangement: e.target.value as 'single-column' | 'two-column',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="single-column">Single Column</option>
              <option value="two-column">Two Columns</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Field Visibility */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold mb-4">Field Visibility</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(fieldVisibility).map(([field, visible]) => (
            <label key={field} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) =>
                  setFieldVisibility({ ...fieldVisibility, [field]: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm text-gray-700 capitalize">{field}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Custom CSS */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold mb-4">Custom CSS</h3>
        <textarea
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          placeholder=".widget-container { ... }"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm h-32"
        />
      </Card>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="flex-1"
        >
          {saving ? <LoadingSpinner size="sm" className="mr-2" /> : null}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
