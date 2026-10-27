import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = { sm: 'h-6 w-6 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' };

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getColor(name: string) {
  const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function InitialsAvatar({ name, size, className }: { name: string; size: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center text-white font-medium shrink-0',
        getColor(name),
        sizeClasses[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={clsx('rounded-full object-cover shrink-0', sizeClasses[size], className)}
      />
    );
  }

  return <InitialsAvatar name={name} size={size} className={className} />;
}

export function AvatarGroup({ users, max = 3 }: { users: { first_name: string; last_name: string; profile_picture?: string }[]; max?: number }) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;
  return (
    <div className="flex -space-x-2">
      {visible.map((u, i) => (
        <Avatar key={i} name={`${u.first_name} ${u.last_name}`} src={u.profile_picture} size="sm" />
      ))}
      {remaining > 0 && (
        <div className="h-6 w-6 rounded-full bg-dark-muted flex items-center justify-center text-xs text-text-muted ring-2 ring-dark-bg">
          +{remaining}
        </div>
      )}
    </div>
  );
}
