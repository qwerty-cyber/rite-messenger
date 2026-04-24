// src/components/Avatar.tsx
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
    md: 'w-10 h-10 text-lg',
    lg: 'w-16 h-16 text-2xl',
  };

  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const firstLetter = name?.trim()?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative inline-flex">
      {src ? (
        <img
          src={src}
          alt={name || 'Аватар'}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-blue-500 flex items-center justify-center text-white font-medium`}
        >
          {firstLetter}
        </div>
      )}

      {/* Индикатор онлайна */}
      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 ${dotSize[size]} rounded-full border-2 border-[#0F0F0F] ${
            online ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
      )}
    </div>
  );
};