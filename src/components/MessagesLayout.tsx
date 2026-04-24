// MessagesLayout.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { useNavigate, useParams, Outlet } from 'react-router-dom';
import { Avatar } from './Avatar';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt?: any;
}

export const MessagesLayout: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatsData);

      const userIds = new Set<string>();
      chatsData.forEach(chat => {
        chat.participants.forEach((id: string) => {
          if (id !== currentUser.uid) userIds.add(id);
        });
      });

      const newUsers: Record<string, any> = {};
      await Promise.all(Array.from(userIds).map(async (uid) => {
        if (!newUsers[uid]) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            newUsers[uid] = {
              ...userDoc.data(),
              online: userDoc.data().online || false
            };
          }
        }
      }));
      setUsers(newUsers);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSelectChat = (id: string) => navigate(`/messages/${id}`);

  const getOtherUser = (chat: Chat) => {
    const otherId = chat.participants.find(id => id !== currentUser?.uid);
    return otherId ? users[otherId] : null;
  };

  // Если выбран конкретный чат — показываем его на весь экран
  if (chatId) {
    return (
      <div className="flex flex-col h-full">
        <Outlet />
      </div>
    );
  }

  // Если чат не выбран — показываем список чатов
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <h1 className="text-2xl font-bold">Сообщения</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="text-center text-[#AAAAAA] py-8 px-4">
            Нет чатов. Найдите пользователя в поиске и напишите ему!
          </div>
        ) : (
          chats.map(chat => {
            const otherUser = getOtherUser(chat);
            if (!otherUser) return null;
            return (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className="p-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={otherUser.photoURL}
                    name={otherUser.displayName}
                    size="md"
                    online={otherUser.online}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {otherUser.displayName || 'Пользователь'}
                      </span>
                      {otherUser.online && (
                        <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-sm text-[#AAAAAA] truncate">
                      {chat.lastMessage || 'Нет сообщений'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};