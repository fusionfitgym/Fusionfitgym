import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizes = {
  sm: { className: 'h-9 w-9', pixels: 36, icon: 'h-4 w-4' },
  md: { className: 'h-10 w-10', pixels: 40, icon: 'h-5 w-5' },
  lg: { className: 'h-14 w-14', pixels: 56, icon: 'h-6 w-6' },
  xl: { className: 'h-24 w-24', pixels: 96, icon: 'h-10 w-10' },
} as const;

export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const config = sizes[size];

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border border-white bg-amber-50 text-amber-700 shadow-sm',
        config.className,
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={config.pixels}
          height={config.pixels}
          sizes={`${config.pixels}px`}
          className="h-full w-full object-cover"
          unoptimized={src.startsWith('blob:') || src.startsWith('data:')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {name ? (
            <span className="text-sm font-bold">{name.charAt(0).toUpperCase()}</span>
          ) : (
            <UserRound className={config.icon} />
          )}
        </div>
      )}
    </div>
  );
}
