// ChatRoom.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { Avatar } from './Avatar';
import { ArrowLeft } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp;
}

export const ChatRoom: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!chatId || !currentUser) return;

    const loadChatInfo = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const otherId = chatData.participants.find((id: string) => id !== currentUser.uid);
        if (otherId) {
          const userDoc = await getDoc(doc(db, 'users', otherId));
          if (userDoc.exists()) {
            setOtherUser({
              id: otherId,
              ...userDoc.data(),
              online: userDoc.data().online || false
            });
          }
        }
      }
    };
    loadChatInfo();

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [chatId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !chatId) return;

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: newMessage,
        senderId: currentUser.uid,
        createdAt: Timestamp.now(),
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: newMessage,
        updatedAt: Timestamp.now(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  if (!chatId) {
    return (
      <div className="h-full flex items-center justify-center text-[#AAAAAA]">
        Выберите чат
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Шапка чата */}
      <div className="px-4 py-3 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center gap-3">
        <button
          onClick={() => navigate('/messages')}
          className="text-blue-400 hover:text-blue-300 p-1 rounded-lg hover:bg-white/10 flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </button>

        {otherUser ? (
          <Link to={`/profile/${otherUser.id}`} className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar
              src={otherUser.photoURL}
              name={otherUser.displayName}
              size="sm"
              online={otherUser.online}
            />
            <div className="min-w-0">
              <div className="font-medium truncate">
                {otherUser.displayName || 'Пользователь'}
              </div>
              <div className="text-xs text-[#AAAAAA]">
                {otherUser.online ? 'Онлайн' : 'Был(а) недавно'}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.senderId === currentUser?.uid
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'glass text-white rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Сообщение..."
          className="flex-1 px-4 py-2 bg-white/10 rounded-xl text-white placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium transition-colors disabled:opacity-50"
          disabled={!newMessage.trim()}
        >
          Отправить
        </button>
      </form>
    </div>
  );
};