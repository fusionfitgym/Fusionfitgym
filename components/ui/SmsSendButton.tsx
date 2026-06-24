'use client';

import { useState } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { openNativeSms } from '@/lib/native-sms';

interface SmsSendButtonProps {
  phone: string | null | undefined;
  message: string;
  /** Visual variant — defaults to 'secondary' */
  variant?: 'primary' | 'secondary' | 'ghost' | 'sms';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Custom label text */
  label?: string;
  /** Extra className override */
  className?: string;
}

/**
 * SmsSendButton
 *
 * Opens the device's default SMS application with the recipient number
 * and message body pre-filled. The user manually presses Send in the SMS app.
 * No external service, gateway, or API is used.
 */
export function SmsSendButton({
  phone,
  message,
  variant = 'secondary',
  size = 'md',
  label = 'Send SMS',
  className = '',
}: SmsSendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setLoading(true);

    // Simulate a brief loading state to give visual feedback
    setTimeout(() => {
      const opened = openNativeSms(phone, message);
      setLoading(false);
      if (!opened) {
        setError('No phone number on file for this member.');
      }
    }, 320);
  }

  const variantClass =
    variant === 'primary'
      ? 'btn btn-primary'
      : variant === 'ghost'
      ? 'btn btn-ghost'
      : variant === 'sms'
      ? 'btn-sms'
      : 'btn btn-secondary';

  const sizeClass = size === 'sm' ? 'btn-sm' : '';

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !phone}
        title={phone ? `Send SMS to ${phone}` : 'Phone number missing'}
        className={`${variantClass} ${sizeClass} ${className}`.trim()}
        aria-label={label}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {loading ? 'Opening...' : label}
      </button>
      {error && (
        <span className="text-[11px] font-medium text-red-600">{error}</span>
      )}
    </span>
  );
}
