import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  onClose,
  ...props
}: AlertProps) {
  const variants = {
    success: {
      bg: 'bg-success-50',
      border: 'border-success-200',
      text: 'text-success-800',
      icon: CheckCircleIcon,
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200',
      text: 'text-error-800',
      icon: XCircleIcon,
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      text: 'text-warning-800',
      icon: ExclamationCircleIcon,
    },
    info: {
      bg: 'bg-primary-50',
      border: 'border-primary-200',
      text: 'text-primary-800',
      icon: InformationCircleIcon,
    },
  };

  const variantStyles = variants[variant];
  const Icon = variantStyles.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        variantStyles.bg,
        variantStyles.border,
        variantStyles.text,
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          {title && <h3 className="font-semibold mb-1">{title}</h3>}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

