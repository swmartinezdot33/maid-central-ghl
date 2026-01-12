'use client';

interface QuoteReviewProps {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  services: string[];
  quoteAmount?: number;
  quoteDate?: string;
  quoteId?: string;
  onConfirm?: () => void;
  onEdit?: () => void;
}

export function QuoteReview({
  customerName,
  email,
  phone,
  address,
  city,
  postalCode,
  services,
  quoteAmount,
  quoteDate,
  quoteId,
  onConfirm,
  onEdit,
}: QuoteReviewProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Quote Summary</h3>

      {/* Customer Information */}
      <div>
        <h4 className="font-medium text-gray-700 mb-2">Customer Information</h4>
        <div className="space-y-1 text-sm text-gray-600">
          <p>
            <span className="font-medium">Name:</span> {customerName}
          </p>
          <p>
            <span className="font-medium">Email:</span> {email}
          </p>
          <p>
            <span className="font-medium">Phone:</span> {phone}
          </p>
        </div>
      </div>

      {/* Service Address */}
      <div>
        <h4 className="font-medium text-gray-700 mb-2">Service Address</h4>
        <div className="space-y-1 text-sm text-gray-600">
          <p>{address}</p>
          <p>
            {city}, {postalCode}
          </p>
        </div>
      </div>

      {/* Selected Services */}
      {services.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Selected Services</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quote Amount */}
      {quoteAmount !== undefined && (
        <div className="border-t border-gray-300 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Estimated Total:</span>
            <span className="text-2xl font-bold text-green-600">${quoteAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Meta Information */}
      {(quoteDate || quoteId) && (
        <div className="bg-white rounded p-3 text-xs text-gray-500 space-y-1">
          {quoteDate && <p>Quote Date: {new Date(quoteDate).toLocaleDateString()}</p>}
          {quoteId && <p>Quote ID: {quoteId}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-300">
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 font-medium hover:bg-gray-300 transition-colors"
          >
            Edit
          </button>
        )}
        {onConfirm && (
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
