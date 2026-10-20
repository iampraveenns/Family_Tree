import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button.tsx';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  id?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Information',
  message = 'An error occurred while fetching your family records. Please try again.',
  onRetry,
  className = '',
  id = 'familyroots-error-state',
}) => {
  return (
    <div
      id={id}
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-rose-200 bg-rose-50/50 ${className}`}
    >
      <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm md:text-base font-semibold text-rose-900">
        {title}
      </h4>
      <p className="text-xs text-rose-700 mt-1 max-w-sm">
        {message}
      </p>
      {onRetry && (
        <div className="mt-4">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};
