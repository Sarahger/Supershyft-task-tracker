import clsx from 'clsx';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function AppLogo({ size = 'sm', showName = true, className }: AppLogoProps) {
  return (
    <div className={clsx('flex items-center gap-2 min-w-0', className)}>
      <img
        src="/supershyft-logo.png"
        alt="SuperShyft"
        className={clsx('shrink-0 object-contain', sizeClasses[size])}
      />
      {showName && (
        <span className="text-sm font-semibold text-text-primary truncate">SuperShyft</span>
      )}
    </div>
  );
}
