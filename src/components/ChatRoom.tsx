// ChatRoom.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, Timestamp, doc, getDoc, getDocs, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { ArrowLeft, Info, Pencil, Reply, Forward, Trash2, X } from 'lucide-react';
import { ChatSidebar } from './ChatSidebar';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp;
  senderName?: string;
  replyTo?: { id: string; text: string } | null;
  isVoice?: boolean;
  voiceDuration?: number;
  voiceUrl?: string;
}

export const ChatRoom: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatData, setChatData] = useState<any>(null);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [blocked, setBlocked] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean; x: number; y: number; messageId: string | null;
    messageText: string; isMyMessage: boolean;
  }>({ visible: false, x: 0, y: 0, messageId: null, messageText: '', isMyMessage: false });
  const [showMsgReactions, setShowMsgReactions] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  const isGroup = chatData?.isGroup || false;
  const isOwner = chatData?.createdBy === currentUser?.uid;
  const isAdmin = chatData?.admins?.includes(currentUser?.uid) || false;
  const otherUser = !isGroup && chatData ? users[chatData.participants.find((id: string) => id !== currentUser?.uid)] : null;

  useEffect(() => {
    if (!chatId || !currentUser) return;
    const unsubscribeChat = onSnapshot(doc(db, 'chats', chatId), (chatDoc) => {
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        setChatData(data);
        const userIds = data.participants.filter((id: string) => id !== currentUser.uid);
        const loadUsers = async () => {
          const newUsers: Record<string, any> = {};
          await Promise.all(userIds.map(async (uid: string) => {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) newUsers[uid] = { id: uid, ...userDoc.data(), online: userDoc.data().online || false };
          }));
          setUsers(newUsers);
        };
        loadUsers();
        if (!data.isGroup && userIds.length === 1) {
          const otherId = userIds[0];
          const checkBlock = async () => {
            const blockQuery = query(collection(db, 'blocks'), where('blockerId', '==', otherId), where('blockedId', '==', currentUser.uid));
            const blockSnapshot = await getDocs(blockQuery);
            setBlocked(!blockSnapshot.empty);
          };
          checkBlock();
        }
      }
    });
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))));
    return () => { unsubscribeChat(); unsubscribeMessages(); };
  }, [chatId, currentUser]);

  // Загрузка реакций на сообщения
  useEffect(() => {
    if (!chatId) return;
    const loadMessageReactions = async () => {
      const q = query(collection(db, 'messageReactions'), where('chatId', '==', chatId));
      const snapshot = await getDocs(q);
      const reacts: Record<string, Record<string, string[]>> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!reacts[data.messageId]) reacts[data.messageId] = {};
        if (!reacts[data.messageId][data.emoji]) reacts[data.messageId][data.emoji] = [];
        reacts[data.messageId][data.emoji].push(data.userId);
      });
      setMessageReactions(reacts);
    };
    loadMessageReactions();
  }, [messages, chatId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) { document.addEventListener('click', handleClick); return () => document.removeEventListener('click', handleClick); }
  }, [contextMenu.visible]);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!currentUser || !chatId) return;
    const typingDoc = doc(db, 'chats', chatId, 'typing', currentUser.uid);
    if (isTyping) await setDoc(typingDoc, { uid: currentUser.uid, timestamp: Timestamp.now() });
    else await deleteDoc(typingDoc);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) { updateTypingStatus(true); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = setTimeout(() => updateTypingStatus(false), 3000); }
    else { updateTypingStatus(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !chatId || blocked) return;
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), { text: newMessage, senderId: currentUser.uid, senderName: currentUser.displayName || 'Пользователь', createdAt: Timestamp.now(), replyTo: replyTo || null });
      await updateDoc(doc(db, 'chats', chatId), { lastMessage: newMessage, updatedAt: Timestamp.now() });
      updateTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setNewMessage(''); setReplyTo(null);
    } catch (error) { console.error('Ошибка отправки:', error); }
  };

  const renderMessageText = (text: string, isMyMessage: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className={`underline break-all ${isMyMessage ? 'text-white hover:text-blue-100' : 'text-blue-400 hover:text-blue-300'}`} onClick={(e) => e.stopPropagation()}>{part}</a>;
      return part;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, messageId: msg.id, messageText: msg.text, isMyMessage: msg.senderId === currentUser?.uid });
  };

  const handleDeleteMessage = async () => {
    if (!contextMenu.messageId || !chatId) return;
    await deleteDoc(doc(db, 'chats', chatId, 'messages', contextMenu.messageId));
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleReply = () => { setReplyTo({ id: contextMenu.messageId!, text: contextMenu.messageText }); setContextMenu({ ...contextMenu, visible: false }); };
  const handleForward = () => { alert('Функция пересылки будет доступна позже'); setContextMenu({ ...contextMenu, visible: false }); };
  const handleEdit = () => { alert('Функция редактирования будет доступна позже'); setContextMenu({ ...contextMenu, visible: false }); };

  const handleMessageReaction = async (msgId: string, emoji: string) => {
    if (!currentUser || !chatId) return;
    try {
      const userReactionQuery = query(collection(db, 'messageReactions'), where('messageId', '==', msgId), where('userId', '==', currentUser.uid));
      const userSnapshot = await getDocs(userReactionQuery);
      const hadThisEmoji = userSnapshot.docs.some(d => d.data().emoji === emoji);

      userSnapshot.docs.forEach(async (d) => await deleteDoc(doc(db, 'messageReactions', d.id)));

      if (!hadThisEmoji) {
        await addDoc(collection(db, 'messageReactions'), { messageId: msgId, chatId, userId: currentUser.uid, emoji, createdAt: Timestamp.now() });
      }

      const q = query(collection(db, 'messageReactions'), where('chatId', '==', chatId));
      const snapshot = await getDocs(q);
      const reacts: Record<string, Record<string, string[]>> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!reacts[data.messageId]) reacts[data.messageId] = {};
        if (!reacts[data.messageId][data.emoji]) reacts[data.messageId][data.emoji] = [];
        reacts[data.messageId][data.emoji].push(data.userId);
      });
      setMessageReactions(reacts);
    } catch (error) { console.error('Ошибка реакции:', error); }
    setShowMsgReactions(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      let seconds = 0;
      recordingTimerRef.current = setInterval(() => { seconds++; setRecordingTime(seconds); }, 1000);
    } catch (error) { console.error('Ошибка доступа к микрофону:', error); alert('Нет доступа к микрофону'); }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      const duration = recordingTime;
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await sendVoiceMessage(file, duration);
        streamRef.current?.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const sendVoiceMessage = async (file: File, duration: number) => {
    if (!currentUser || !chatId) return;
    try {
      const audioUrl = URL.createObjectURL(file);
      await addDoc(collection(db, 'chats', chatId, 'messages'), { text: '🎤 Голосовое сообщение', senderId: currentUser.uid, senderName: currentUser.displayName || 'Пользователь', createdAt: Timestamp.now(), isVoice: true, voiceDuration: duration, voiceUrl: audioUrl });
      await updateDoc(doc(db, 'chats', chatId), { lastMessage: '🎤 Голосовое сообщение', updatedAt: Timestamp.now() });
    } catch (error) { console.error('Ошибка отправки голосового:', error); }
  };

  const getChatTitle = () => {
    if (isGroup) return chatData?.groupName || 'Группа';
    return otherUser?.displayName || 'Пользователь';
  };

  if (!chatId) return <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">Выберите чат</div>;

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-3 bg-white/5 backdrop-blur-xl border-b border-[var(--border-color)] flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="text-blue-400 hover:text-blue-300 p-1 rounded-lg hover:bg-white/10 flex-shrink-0"><ArrowLeft size={20} /></button>
          <Link to={isGroup ? '#' : `/profile/${otherUser?.id}`} className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar src={isGroup ? (chatData?.groupPhoto || null) : (otherUser?.photoURL || null)} name={getChatTitle()} size="sm" online={!isGroup && otherUser?.online} />
            <div className="min-w-0"><div className="font-medium truncate text-[var(--text-primary)]">{getChatTitle()}</div><div className="text-xs text-[var(--text-secondary)]">{isGroup ? `${chatData?.participants?.length || 0} участников` : (otherUser?.online ? 'Онлайн' : 'Был(а) недавно')}</div></div>
          </Link>
          <button onClick={() => setShowSidebar(!showSidebar)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-white/10 flex-shrink-0"><Info size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="flex flex-col justify-end min-h-full">
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const isSameSender = prevMsg?.senderId === msg.senderId;
              const isMyMessage = msg.senderId === currentUser?.uid;
              return (
                <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`} style={{ marginTop: isSameSender ? '1px' : '4px' }} onContextMenu={(e) => handleContextMenu(e, msg)}>
                  <div className={`max-w-[90%] ${isGroup && !isMyMessage ? 'ml-10' : ''}`}>
                    {isGroup && !isMyMessage && !isSameSender && <p className="text-xs text-blue-400 mb-0.5 ml-1">{msg.senderName || 'Пользователь'}</p>}
                    {msg.replyTo && <div className="text-xs text-[var(--text-secondary)] mb-0.5 ml-1 border-l-2 border-blue-400 pl-2">{msg.replyTo.text?.substring(0, 50)}{(msg.replyTo.text?.length || 0) > 50 ? '...' : ''}</div>}
                    <div className={`inline-block px-3 py-1.5 rounded-xl text-sm break-words ${isMyMessage ? 'bg-blue-500 text-white rounded-br-sm' : 'glass text-[var(--text-primary)] rounded-bl-sm'}`}>
                      {msg.isVoice ? (
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <button onClick={() => { const audio = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement; if (audio) { if (audio.paused) { document.querySelectorAll('audio').forEach(a => a.pause()); audio.play(); } else { audio.pause(); } } }} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors">▶️</button>
                          <div className="flex-1"><div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white/60 rounded-full transition-all duration-300" style={{ width: '0%' }} id={`progress-${msg.id}`} /></div></div>
                          <audio id={`audio-${msg.id}`} src={msg.voiceUrl} onTimeUpdate={(e) => { const audio = e.target as HTMLAudioElement; const progress = document.getElementById(`progress-${msg.id}`); if (progress) progress.style.width = `${(audio.currentTime / (audio.duration || 1)) * 100}%`; }} onEnded={() => { const progress = document.getElementById(`progress-${msg.id}`); if (progress) progress.style.width = '0%'; }} className="hidden" />
                          <span className="text-xs opacity-70 whitespace-nowrap">{msg.voiceDuration}с</span>
                        </div>
                      ) : (renderMessageText(msg.text, isMyMessage))}
                    </div>
                    {/* Реакции под сообщением */}
                    {messageReactions[msg.id] && Object.keys(messageReactions[msg.id]).length > 0 && (
                      <div className={`flex gap-1 mt-0.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(messageReactions[msg.id]).map(([emoji, users]) => (
                          <button key={emoji} onClick={() => handleMessageReaction(msg.id, emoji)} className="bg-white/10 hover:bg-white/20 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 transition-colors">
                            <span>{emoji}</span>
                            <span className="text-[var(--text-secondary)]">{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {replyTo && (
          <div className="px-3 py-2 border-t border-[var(--border-color)] bg-white/5 flex items-center gap-3">
            <div className="flex-1 min-w-0"><p className="text-xs text-blue-400 mb-0.5">Ответ</p><p className="text-sm text-[var(--text-secondary)] truncate">{replyTo.text}</p></div>
            <button onClick={() => setReplyTo(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={16} /></button>
          </div>
        )}

        {blocked ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-sm border-t border-[var(--border-color)]">Вы не можете отправлять сообщения этому пользователю</div>
        ) : isRecording ? (
          <div className="p-3 border-t border-[var(--border-color)] bg-red-500/10 backdrop-blur-xl flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-sm text-[var(--text-primary)] flex-1">Запись... {recordingTime}с</span>
            <button onClick={stopRecording} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-xl font-medium text-sm transition-colors">⏹️ Отправить</button>
          </div>
        ) : (
          <form onSubmit={sendMessage} className="p-3 border-t border-[var(--border-color)] bg-white/5 backdrop-blur-xl flex gap-2">
            <button type="button" onClick={startRecording} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-lg">🎤</button>
            <input type="text" value={newMessage} onChange={handleInputChange} placeholder="Сообщение..." className="flex-1 px-4 py-2 bg-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex-shrink-0" disabled={!newMessage.trim()}>Отправить</button>
          </form>
        )}
      </div>

      {showSidebar && <ChatSidebar chatId={chatId!} otherUser={otherUser} chatData={chatData} onClose={() => setShowSidebar(false)} />}

      {contextMenu.visible && (
        <div className="fixed bg-[var(--bg-secondary)] backdrop-blur-xl rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden py-1" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px`, zIndex: 99999 }}>
          {contextMenu.isMyMessage && <button onClick={handleEdit} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/10 text-left flex items-center gap-2"><Pencil size={14} /> Редактировать</button>}
          <button onClick={handleReply} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/10 text-left flex items-center gap-2"><Reply size={14} /> Ответить</button>
          <button onClick={handleForward} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/10 text-left flex items-center gap-2"><Forward size={14} /> Переслать</button>
          <button onClick={() => { setShowMsgReactions(contextMenu.messageId); setContextMenu({ ...contextMenu, visible: false }); }} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/10 text-left flex items-center gap-2">😊 Реакция</button>
          {(contextMenu.isMyMessage || isOwner || isAdmin) && <button onClick={handleDeleteMessage} className="w-full px-4 py-2 text-sm text-red-400 hover:bg-white/10 text-left flex items-center gap-2"><Trash2 size={14} /> Удалить</button>}
        </div>
      )}

      {showMsgReactions && (
        <div className="fixed inset-0 z-[99999] flex items-end justify-center pb-20" onClick={() => setShowMsgReactions(null)}>
          <div className="bg-[var(--bg-secondary)] backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border-color)] p-3 flex gap-2" onClick={e => e.stopPropagation()}>
            {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
              <button key={emoji} onClick={() => handleMessageReaction(showMsgReactions, emoji)} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">{emoji}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};