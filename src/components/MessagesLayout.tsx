// MessagesLayout.tsx
import React from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { ChatList } from './ChatList';
import { MessageCircle } from 'lucide-react';

export const MessagesLayout: React.FC = () => {
  const { chatId } = useParams<{ chatId?: string }>();

  return (
    <div className="flex h-full">
      <div className={`${chatId ? 'hidden md:block' : 'block'} w-full md:w-80 flex-shrink-0`}>
        <ChatList />
      </div>

      <div className={`${chatId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
        {chatId ? (
          <Outlet />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <MessageCircle size={40} className="text-[var(--text-secondary)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                Выберите чат
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                Выберите существующий диалог слева или найдите пользователя в поиске, чтобы начать новый чат
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};