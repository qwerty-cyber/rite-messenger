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
  setDoc,
  deleteDoc,
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
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  // Загрузка чата и собеседника
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

  // Отслеживание статуса "печатает" у собеседника
  useEffect(() => {
    if (!chatId || !otherUser?.id) return;

    const typingDoc = doc(db, 'chats', chatId, 'typing', otherUser.id);
    const unsubscribe = onSnapshot(typingDoc, (snap) => {
      if (snap.exists() && snap.data().timestamp?.toMillis() > Date.now() - 5000) {
        setTyping(true);
      } else {
        setTyping(false);
      }
    });

    return () => unsubscribe();
  }, [chatId, otherUser]);

  // Автопрокрутка вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Отправка статуса "печатает"
  const updateTypingStatus = async (isTyping: boolean) => {
    if (!currentUser || !chatId) return;

    const typingDoc = doc(db, 'chats', chatId, 'typing', currentUser.uid);

    if (isTyping) {
      await setDoc(typingDoc, {
        uid: currentUser.uid,
        timestamp: Timestamp.now()
      });
    } else {
      await deleteDoc(typingDoc);
    }
  };

  // Обработчик изменения текста
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (e.target.value.trim()) {
      updateTypingStatus(true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 3000);
    } else {
      updateTypingStatus(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // Отправка сообщения
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

      // Убираем статус "печатает"
      updateTypingStatus(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      setNewMessage('');
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  if (!chatId) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
        Выберите чат
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Шапка чата */}
      <div className="px-4 py-3 bg-white/5 backdrop-blur-xl border-b border-[var(--border-color)] flex items-center gap-3">
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
              <div className="font-medium truncate text-[var(--text-primary)]">
                {otherUser.displayName || 'Пользователь'}
              </div>
              <div className="text-xs">
                {typing ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    печатает
                  </span>
                ) : (
                  <span className="text-[var(--text-secondary)]">
                    {otherUser.online ? 'Онлайн' : 'Был(а) недавно'}
                  </span>
                )}
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
                  : 'glass text-[var(--text-primary)] rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <form onSubmit={sendMessage} className="p-4 border-t border-[var(--border-color)] bg-white/5 backdrop-blur-xl flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Сообщение..."
          className="flex-1 px-4 py-2 bg-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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