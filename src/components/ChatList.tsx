// ChatList.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from './Avatar';
import { MessageCircle, Plus } from 'lucide-react';
import { CreateGroupModal } from './CreateGroupModal';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt?: any;
  lastRead?: Record<string, any>;
  isGroup?: boolean;
  groupName?: string;
}

export const ChatList: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatsData);
      const userIds = new Set<string>();
      chatsData.forEach(chat => chat.participants.forEach((id: string) => { if (id !== currentUser.uid) userIds.add(id); }));
      const newUsers: Record<string, any> = { ...users };
      await Promise.all(Array.from(userIds).map(async (uid) => {
        if (!newUsers[uid]) { const userDoc = await getDoc(doc(db, 'users', uid)); if (userDoc.exists()) newUsers[uid] = { ...userDoc.data(), online: userDoc.data().online || false }; }
      }));
      setUsers(newUsers);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleSelectChat = (id: string) => navigate(`/messages/${id}`);

  const getChatName = (chat: Chat) => {
    if (chat.isGroup && chat.groupName) return chat.groupName;
    const otherId = chat.participants.find(id => id !== currentUser?.uid);
    const otherUser = otherId ? users[otherId] : null;
    return otherUser?.displayName || 'Пользователь';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.isGroup) return null;
    const otherId = chat.participants.find(id => id !== currentUser?.uid);
    const otherUser = otherId ? users[otherId] : null;
    return otherUser?.photoURL || null;
  };

  const getChatOnline = (chat: Chat) => {
    if (chat.isGroup) return false;
    const otherId = chat.participants.find(id => id !== currentUser?.uid);
    const otherUser = otherId ? users[otherId] : null;
    return otherUser?.online || false;
  };

  // Проверка непрочитанных
  const hasUnread = (chat: Chat) => {
    if (!currentUser || !chat.updatedAt) return false;
    const lastRead = chat.lastRead?.[currentUser.uid]?.toMillis() || 0;
    const updatedAt = chat.updatedAt?.toMillis() || 0;
    return updatedAt > lastRead;
  };

  return (
    <div className="w-full h-full flex flex-col bg-black/40 backdrop-blur-xl">
      <div className="p-4 border-b border-[var(--border-color)] flex items-center flex-shrink-0">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Сообщения</h2>
        <button onClick={() => setShowCreateGroup(true)} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-secondary)] py-8 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <MessageCircle size={32} className="text-[var(--text-secondary)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Нет чатов</p>
            <p className="text-xs text-[var(--text-secondary)]">Найдите пользователя в поиске и напишите ему!</p>
          </div>
        ) : (
          chats.map(chat => (
            <div key={chat.id} onClick={() => handleSelectChat(chat.id)} className={`p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 ${chatId === chat.id ? 'bg-white/10' : ''}`}>
              <div className="flex items-center gap-3">
                <Avatar src={getChatAvatar(chat)} name={getChatName(chat)} size="md" online={getChatOnline(chat)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`truncate ${hasUnread(chat) ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>
                      {getChatName(chat)}
                    </span>
                    {hasUnread(chat) && <span className="w-2 h-2 bg-accent rounded-full flex-shrink-0" />}
                    {chat.isGroup && <span className="text-xs text-accent flex-shrink-0">Группа</span>}
                  </div>
                  <div className={`text-sm truncate ${hasUnread(chat) ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {chat.lastMessage || 'Нет сообщений'}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
};