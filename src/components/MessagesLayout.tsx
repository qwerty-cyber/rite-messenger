// MessagesLayout.tsx
import React from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { ChatList } from './ChatList';

export const MessagesLayout: React.FC = () => {
  const { chatId } = useParams<{ chatId?: string }>();

  return (
    <div className="flex h-full">
      {/* Список чатов — всегда виден, когда нет выбранного чата */}
      <div className={`${chatId ? 'hidden md:block' : 'block'} w-full md:w-80 flex-shrink-0`}>
        <ChatList />
      </div>

      {/* Область чата — только когда выбран chatId */}
      <div className={`${chatId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
        <Outlet />
      </div>
    </div>
  );
};