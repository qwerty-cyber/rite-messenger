import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', online }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-2xl',
  };

  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const firstLetter = name && name.trim().length > 0
    ? name.trim()[0].toUpperCase()
    : '?';

  return (
    <div className="relative inline-flex flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={name || 'Аватар'}
          className={`${sizeClasses[size]} rounded-full object-cover`}
          onError={(e) => {
            // Если картинка не загрузилась — скрываем img и показываем букву
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement?.querySelector('.fallback')?.classList.remove('hidden');
          }}
        />
      ) : null}

      <div
        className={`${sizeClasses[size]} rounded-full bg-accent flex items-center justify-center text-white font-medium fallback ${src ? 'hidden' : ''}`}
      >
        {firstLetter}
      </div>

      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 ${dotSize[size]} rounded-full border-2 border-[var(--bg-primary)] ${
            online ? 'bg-green-500' : 'bg-gray-500'
          }`}
          style={{ borderColor: 'var(--bg-primary, #0F0F0F)' }}
        />
      )}
    </div>
  );
};