'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LocationGuard } from '@/components/LocationGuard';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeftIcon, PlusIcon, TrashIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface Field {
  name: string;
  label: string;
  type?: string;
  category?: string;
}

interface FieldMapping {
  maidCentralField: string;
  ghlField: string;
  maidCentralLabel?: string;
  ghlLabel?: string;
}

interface Config {
  enabled: boolean;
  ghlLocationId?: string;
  fieldMappings: FieldMapping[];
  ghlTag?: string;
}

export default function MappingPage() {
  const router = useRouter();
  const { ghlData } = useGHLIframe();
  const [mcFields, setMcFields] = useState<Field[]>([]);
  const [ghlFields, setGhlFields] = useState<Field[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const locationId = ghlData?.locationId;
      const configUrl = locationId ? `/api/config?locationId=${locationId}` : '/api/config';
      const configRes = await fetch(configUrl);
      const configData = await configRes.json();
      setConfig(configData.config);
      setMappings(configData.config?.fieldMappings || []);

      try {
        const mcRes = await fetch('/api/maid-central/fields');
        const mcData = await mcRes.json();
        const fields = mcData.fields.map((field: string) => ({
          name: field,
          label: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'),
        }));
        setMcFields(fields);
      } catch (error) {
        console.error('Error loading Maid Central fields:', error);
        setMessage({ type: 'error', text: 'Failed to load MaidCentral fields. Please ensure credentials are configured.' });
      }

      const locationIdToUse = configData.config?.ghlLocationId || locationId;
      if (locationIdToUse) {
        try {
          const ghlRes = await fetch(`/api/ghl/fields?locationId=${locationIdToUse}`);
          if (!ghlRes.ok) {
            const errorData = await ghlRes.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${ghlRes.status}: ${ghlRes.statusText}`);
          }
          
          const ghlData = await ghlRes.json();
          if (ghlData.error) {
            throw new Error(ghlData.error);
          }
          
          if (!ghlData.fields || !Array.isArray(ghlData.fields)) {
            throw new Error('Invalid response format from GHL fields API');
          }
          
          setGhlFields(ghlData.fields);
        } catch (error) {
          console.error('Error loading GHL fields:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setMessage({ type: 'error', text: `Failed to load CRM fields: ${errorMsg}` });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { maidCentralField: '', ghlField: '' }]);
  };

  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'maidCentralField') {
      const mcField = mcFields.find(f => f.name === value);
      updated[index].maidCentralLabel = mcField?.label;
    }
    if (field === 'ghlField') {
      const ghlField = ghlFields.find(f => f.name === value);
      updated[index].ghlLabel = ghlField?.label;
    }
    
    setMappings(updated);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const saveMappings = async () => {
    setSaving(true);
    setMessage(null);

    const validMappings = mappings.filter(m => m.maidCentralField && m.ghlField);

    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: validMappings }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Field mappings saved successfully!' });
        setMappings(validMappings);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save mappings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save mappings' });
    } finally {
      setSaving(false);
    }
  };

  const toggleIntegration = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setMessage({ type: 'success', text: `Integration ${enabled ? 'enabled' : 'disabled'}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update integration status' });
    }
  };

  if (loading) {
    return (
      <LocationGuard>
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Card padding="lg">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-20 w-full" />
          </Card>
        </div>
      </LocationGuard>
    );
  }

  return (
    <LocationGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Field Mapping</h1>
            <p className="text-gray-600 mt-1">Map MaidCentral quote fields to CRM contact fields</p>
          </div>
        </div>

        {message && (
          <Alert
            variant={message.type === 'error' ? 'error' : 'success'}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        {/* Integration Toggle */}
        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Toggle
                label="Enable Integration"
                description={config?.enabled ? 'Integration is enabled and ready to sync quotes manually.' : 'Integration is disabled.'}
                checked={config?.enabled || false}
                onChange={(e) => toggleIntegration(e.target.checked)}
              />
            </div>
            <Badge variant={config?.enabled ? 'success' : 'error'}>
              {config?.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </Card>

        {/* Field Mappings */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Field Mappings</h2>
            <Button onClick={addMapping} variant="primary" size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Mapping
            </Button>
          </div>

          {mappings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-gray-500 mb-4">No mappings configured</p>
              <Button onClick={addMapping} variant="secondary">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Your First Mapping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping, index) => (
                <Card key={index} padding="md" className="bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        MaidCentral Field
                      </label>
                      <Select
                        options={[
                          { value: '', label: 'Select field...' },
                          ...mcFields.map(field => ({ value: field.name, label: field.label }))
                        ]}
                        value={mapping.maidCentralField}
                        onChange={(e) => updateMapping(index, 'maidCentralField', e.target.value)}
                      />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                        CRM Field
                      </label>
                      <div className="flex gap-2">
                        <Select
                          options={[
                            { value: '', label: 'Select field...' },
                            ...ghlFields.map(field => ({
                              value: field.name,
                              label: `${field.label}${field.category === 'opportunity' ? ' (Opportunity)' : ''}${field.category === 'object' ? ' (Object)' : ''}${field.category === 'contact' && field.type !== 'standard' ? ' (Contact Custom)' : ''}${field.type === 'standard' ? ' (Standard)' : ''}`
                            }))
                          ]}
                          value={mapping.ghlField}
                          onChange={(e) => updateMapping(index, 'ghlField', e.target.value)}
                          className="flex-1"
                        />
                        {mappings.length > 1 && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeMapping(index)}
                            className="px-3"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {mappings.length > 0 && (
            <div className="mt-6">
              <Button 
                onClick={saveMappings} 
                variant="primary" 
                disabled={saving}
                className="w-full"
                size="lg"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Mappings'
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </LocationGuard>
  );
}
