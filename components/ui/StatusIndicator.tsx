import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'warning' | 'loading';
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  size = 'md',
  className,
}: StatusIndicatorProps) {
  const sizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const statusConfig = {
    connected: {
      icon: CheckCircleIcon,
      color: 'text-success-600',
      bg: 'bg-success-100',
    },
    disconnected: {
      icon: XCircleIcon,
      color: 'text-error-600',
      bg: 'bg-error-100',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      color: 'text-warning-600',
      bg: 'bg-warning-100',
    },
    loading: {
      icon: null,
      color: 'text-gray-400',
      bg: 'bg-gray-100',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {status === 'loading' ? (
        <div className={cn('animate-spin rounded-full border-2 border-gray-300 border-t-primary-600', sizes[size])} />
      ) : Icon ? (
        <Icon className={cn(sizes[size], config.color)} />
      ) : null}
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );
}

