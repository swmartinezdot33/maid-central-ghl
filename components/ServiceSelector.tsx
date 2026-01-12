'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ServiceSelectorProps {
  scopeGroupId: string;
  selectedScopes: string[];
  onScopesChange: (scopes: string[]) => void;
  locationId?: string;
}

export function ServiceSelector({
  scopeGroupId,
  selectedScopes,
  onScopesChange,
  locationId,
}: ServiceSelectorProps) {
  const [scopes, setScopes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!scopeGroupId || !locationId) return;

    const loadScopes = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/maid-central/scopes?scopeGroupId=${scopeGroupId}&locationId=${locationId}`
        );

        if (response.ok) {
          const data = await response.json();
          setScopes(data.scopes || []);
          
          // Extract prices from scopes
          const pricesMap: Record<string, number> = {};
          (data.scopes || []).forEach((scope: any) => {
            const scopeId = scope.ScopeId || scope.scopeId || scope.id;
            const price = scope.Price || scope.price || scope.Amount || scope.amount || 0;
            pricesMap[scopeId] = price;
          });
          setPrices(pricesMap);
        }
      } catch (error) {
        console.error('Error loading scopes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadScopes();
  }, [scopeGroupId, locationId]);

  const handleToggleScope = (scopeId: string) => {
    const updated = selectedScopes.includes(scopeId)
      ? selectedScopes.filter((s) => s !== scopeId)
      : [...selectedScopes, scopeId];
    onScopesChange(updated);
  };

  const totalPrice = selectedScopes.reduce((sum, scopeId) => sum + (prices[scopeId] || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scopes.map((scope: any) => {
        const scopeId = scope.ScopeId || scope.scopeId || scope.id;
        const isSelected = selectedScopes.includes(scopeId);
        const price = prices[scopeId] || 0;

        return (
          <div
            key={scopeId}
            className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleToggleScope(scopeId)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleScope(scopeId)}
                  className="rounded cursor-pointer"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {scope.ScopeName || scope.scopeName || scope.name}
                  </p>
                  {scope.Description && (
                    <p className="text-sm text-gray-500 mt-1">{scope.Description}</p>
                  )}
                </div>
              </div>
              {price > 0 && <p className="font-semibold text-gray-900">${price.toFixed(2)}</p>}
            </div>
          </div>
        );
      })}

      {selectedScopes.length > 0 && (
        <div className="border-t pt-3 mt-4">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Subtotal:</span>
            <span className="font-bold text-lg text-gray-900">${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
