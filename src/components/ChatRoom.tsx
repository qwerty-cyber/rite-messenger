// ChatRoom.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, Timestamp, doc, getDoc, getDocs, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { ArrowLeft, Info, Pencil, Reply, Forward, Trash2, X } from 'lucide-react';
import { ChatSidebar } from './ChatSidebar';
import { useToast } from './Toast';
import { motion } from 'framer-motion';

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
  isSticker?: boolean;
  edited?: boolean;
  editedAt?: Timestamp;
}

export const ChatRoom: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [chatData, setChatData] = useState<any>(null);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [blocked, setBlocked] = useState(false);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 768);
  const [showWallpaper, setShowWallpaper] = useState(false);
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
  const [showStickers, setShowStickers] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isGroup = chatData?.isGroup || false;
  const isOwner = chatData?.createdBy === currentUser?.uid;
  const isAdmin = chatData?.admins?.includes(currentUser?.uid) || false;
  const otherUser = !isGroup && chatData ? users[chatData.participants.find((id: string) => id !== currentUser?.uid)] : null;

  const stickers = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '💯', '👋', '🤝', '💪', '🥳', '😎', '🤔', '👀', '🙏', '💀', '🐶', '🌚'];
  const chatBackground = chatId ? localStorage.getItem(`chatBg_${chatId}`) || '' : '';

  const wallpapers = [
    { name: 'Нет', value: '' }, { name: 'Горы', value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' }, { name: 'Космос', value: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400' }, { name: 'Лес', value: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400' }, { name: 'Океан', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' }, { name: 'Абстракция', value: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400' }, { name: 'Тёмная', value: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=400' }, { name: 'Закат', value: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400' }, { name: 'Волны', value: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400' },
  ];

  const playSendSound = () => { try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.1; osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); osc.stop(ctx.currentTime + 0.1); } catch (e) {} };
  const playReceiveSound = () => { if (localStorage.getItem('dnd') === 'true') return; try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 600; gain.gain.value = 0.1; osc.start(); osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.15); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); osc.stop(ctx.currentTime + 0.3); } catch (e) {} };

  useEffect(() => {
    if (!chatId || !currentUser) return;
    const unsubscribeChat = onSnapshot(doc(db, 'chats', chatId), (chatDoc) => {
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        setChatData(data);
        const userIds = data.participants.filter((id: string) => id !== currentUser.uid);
        const loadUsers = async () => { const newUsers: Record<string, any> = {}; await Promise.all(userIds.map(async (uid: string) => { const userDoc = await getDoc(doc(db, 'users', uid)); if (userDoc.exists()) newUsers[uid] = { id: uid, ...userDoc.data(), online: userDoc.data().online || false }; })); setUsers(newUsers); };
        loadUsers();
        if (!data.isGroup && userIds.length === 1) { const otherId = userIds[0]; const checkBlock = async () => { const blockQuery = query(collection(db, 'blocks'), where('blockerId', '==', otherId), where('blockedId', '==', currentUser.uid)); const blockSnapshot = await getDocs(blockQuery); setBlocked(!blockSnapshot.empty); }; checkBlock(); }
        updateDoc(doc(db, 'chats', chatId), { [`lastRead.${currentUser.uid}`]: Timestamp.now() }).catch(() => {});
      }
    });
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      const lastDoc = snapshot.docChanges().find(c => c.type === 'added');
      if (lastDoc && currentUser) {
        const msgData = lastDoc.doc.data();
        const isNew = msgData.createdAt && (Timestamp.now().toMillis() - msgData.createdAt.toMillis()) < 3000;
        if (isNew && msgData.senderId !== currentUser.uid) {
          playReceiveSound();
          if (document.visibilityState !== 'visible') { const senderName = msgData.senderName || getChatTitle(); showNotification(`Новое сообщение от ${senderName}`, msgData.isVoice ? '🎤 Голосовое сообщение' : msgData.text, isGroup ? chatData?.groupPhoto : otherUser?.photoURL); }
        }
      }
      setMessages(msgs);
      msgs.forEach(async (msg) => { if (msg.text && !msg.isSticker && !msg.isVoice) { const urlMatch = msg.text.match(/(https?:\/\/[^\s]+)/i); if (urlMatch && !linkPreviews[urlMatch[0]]) { const preview = await fetchLinkPreview(urlMatch[0]); if (preview) setLinkPreviews(prev => ({ ...prev, [urlMatch[0]]: preview })); } } });
    });
    return () => { unsubscribeChat(); unsubscribeMessages(); };
  }, [chatId, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false })); if (contextMenu.visible) { document.addEventListener('click', handleClick); return () => document.removeEventListener('click', handleClick); } }, [contextMenu.visible]);
  useEffect(() => { const handleResize = () => { if (window.innerWidth <= 768) setShowSidebar(false); }; window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);

  const fetchLinkPreview = async (url: string) => { try { const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`); const data = await response.json(); if (data.status === 'success') return { title: data.data.title || '', description: data.data.description || '', image: data.data.image?.url || '', url: url }; } catch (error) {} return null; };
  const scrollToMessage = (messageId: string) => { if (window.innerWidth <= 768) setShowSidebar(false); setTimeout(() => { const element = document.getElementById(`msg-${messageId}`); if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); element.classList.add('bg-blue-500/10', 'rounded-xl'); setTimeout(() => element.classList.remove('bg-blue-500/10', 'rounded-xl'), 2500); } }, 100); };
  const showNotification = (title: string, body: string, icon?: string) => { if (!('Notification' in window)) return; if (Notification.permission === 'granted') { try { new Notification(title, { body, icon: icon || undefined }); } catch (error) {} } else if (Notification.permission === 'default') { Notification.requestPermission().then(permission => { if (permission === 'granted') new Notification(title, { body, icon: icon || undefined }); }); } };
  const updateTypingStatus = async (isTyping: boolean) => { if (!currentUser || !chatId) return; const typingDoc = doc(db, 'chats', chatId, 'typing', currentUser.uid); if (isTyping) await setDoc(typingDoc, { uid: currentUser.uid, timestamp: Timestamp.now() }); else await deleteDoc(typingDoc); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNewMessage(e.target.value); if (e.target.value.trim()) { updateTypingStatus(true); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = setTimeout(() => updateTypingStatus(false), 3000); } else { updateTypingStatus(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); } };
  const sendMessage = async (e: React.FormEvent) => { e.preventDefault(); if (!newMessage.trim() || !currentUser || !chatId || blocked) return; const tempText = newMessage; setNewMessage(''); playSendSound(); try { if (editingMessage) { await updateDoc(doc(db, 'chats', chatId, 'messages', editingMessage.id), { text: tempText, edited: true, editedAt: Timestamp.now() }); setEditingMessage(null); showToast('Сообщение изменено', 'success'); } else { await addDoc(collection(db, 'chats', chatId, 'messages'), { text: tempText, senderId: currentUser.uid, senderName: currentUser.displayName || 'Пользователь', createdAt: Timestamp.now(), replyTo: replyTo || null }); } await updateDoc(doc(db, 'chats', chatId), { lastMessage: tempText, updatedAt: Timestamp.now() }); updateTypingStatus(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); setReplyTo(null); } catch (error) {} };
  const sendSticker = async (sticker: string) => { if (!currentUser || !chatId) return; try { await addDoc(collection(db, 'chats', chatId, 'messages'), { text: sticker, senderId: currentUser.uid, senderName: currentUser.displayName || 'Пользователь', createdAt: Timestamp.now(), isSticker: true }); await updateDoc(doc(db, 'chats', chatId), { lastMessage: '🎨 Стикер', updatedAt: Timestamp.now() }); setShowStickers(false); } catch (error) {} };
  const renderMessageText = (text: string, isMyMessage: boolean) => { const urlRegex = /(https?:\/\/[^\s]+)/gi; const parts = text.split(urlRegex); return parts.map((part, index) => { if (part.match(urlRegex)) return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className={`underline break-all ${isMyMessage ? 'text-white hover:text-blue-100' : 'text-blue-400 hover:text-blue-300'}`} onClick={(e) => e.stopPropagation()}>{part}</a>; return part; }); };
  const handleContextMenu = (e: React.MouseEvent, msg: Message) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, messageId: msg.id, messageText: msg.text, isMyMessage: msg.senderId === currentUser?.uid }); };
  const handleDeleteMessage = async () => { if (!contextMenu.messageId || !chatId) return; await deleteDoc(doc(db, 'chats', chatId, 'messages', contextMenu.messageId)); setContextMenu({ ...contextMenu, visible: false }); showToast('Сообщение удалено', 'success'); };
  const handleReply = () => { setReplyTo({ id: contextMenu.messageId!, text: contextMenu.messageText }); setContextMenu({ ...contextMenu, visible: false }); };
  const handleForward = () => { if (contextMenu.messageText) { navigator.clipboard.writeText(contextMenu.messageText); showToast('Текст скопирован!', 'success'); } setContextMenu({ ...contextMenu, visible: false }); };
  const handleEdit = () => { if (contextMenu.messageId && contextMenu.messageText) { setEditingMessage({ id: contextMenu.messageId, text: contextMenu.messageText }); setNewMessage(contextMenu.messageText); setContextMenu({ ...contextMenu, visible: false }); } };
  const handleMessageReaction = async (msgId: string, emoji: string) => { if (!currentUser || !chatId) return; try { const userReactionQuery = query(collection(db, 'messageReactions'), where('messageId', '==', msgId), where('userId', '==', currentUser.uid)); const userSnapshot = await getDocs(userReactionQuery); const hadThisEmoji = userSnapshot.docs.some(d => d.data().emoji === emoji); userSnapshot.docs.forEach(async (d) => await deleteDoc(doc(db, 'messageReactions', d.id))); if (!hadThisEmoji) await addDoc(collection(db, 'messageReactions'), { messageId: msgId, chatId, userId: currentUser.uid, emoji, createdAt: Timestamp.now() }); const q = query(collection(db, 'messageReactions'), where('chatId', '==', chatId)); const snapshot = await getDocs(q); const reacts: Record<string, Record<string, string[]>> = {}; snapshot.docs.forEach(doc => { const data = doc.data(); if (!reacts[data.messageId]) reacts[data.messageId] = {}; if (!reacts[data.messageId][data.emoji]) reacts[data.messageId][data.emoji] = []; reacts[data.messageId][data.emoji].push(data.userId); }); setMessageReactions(reacts); } catch (error) {} setShowMsgReactions(null); };
  const startRecording = async () => { try { if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showToast('Браузер не поддерживает запись', 'error'); return; } const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; chunksRef.current = []; const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); recorder.ondataavailable = (e) => chunksRef.current.push(e.data); recorder.onerror = () => { showToast('Ошибка записи', 'error'); setIsRecording(false); }; recorder.start(); setMediaRecorder(recorder); setIsRecording(true); setRecordingTime(0); let seconds = 0; recordingTimerRef.current = setInterval(() => { seconds++; setRecordingTime(seconds); }, 1000); } catch (error) { showToast('Нет доступа к микрофону', 'error'); } };
  const stopRecording = () => { if (mediaRecorder && isRecording) { const duration = recordingTime; mediaRecorder.onstop = async () => { const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' }); await sendVoiceMessage(file, duration); streamRef.current?.getTracks().forEach(track => track.stop()); }; mediaRecorder.stop(); setIsRecording(false); setRecordingTime(0); if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); } };
  const sendVoiceMessage = async (file: File, duration: number) => { if (!currentUser || !chatId) return; try { const reader = new FileReader(); reader.onload = async () => { const voiceUrl = reader.result as string; await addDoc(collection(db, 'chats', chatId, 'messages'), { text: '🎤 Голосовое сообщение', senderId: currentUser.uid, senderName: currentUser.displayName || 'Пользователь', createdAt: Timestamp.now(), isVoice: true, voiceDuration: duration, voiceUrl: voiceUrl }); await updateDoc(doc(db, 'chats', chatId), { lastMessage: '🎤 Голосовое сообщение', updatedAt: Timestamp.now() }); }; reader.onerror = () => { showToast('Ошибка чтения файла', 'error'); }; reader.readAsDataURL(file); } catch (error) { showToast('Ошибка отправки', 'error'); } };
  const getChatTitle = () => { return isGroup ? chatData?.groupName || 'Группа' : otherUser?.displayName || 'Пользователь'; };

  if (!chatId) return <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">Выберите чат</div>;

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-4 py-3 bg-white/5 backdrop-blur-xl border-b border-[var(--border-color)] flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="text-accent hover:text-blue-300 p-1 rounded-lg hover:bg-white/10 flex-shrink-0"><ArrowLeft size={20} /></button>
          <Link to={isGroup ? '#' : otherUser?.id === currentUser?.uid ? '/profile' : `/profile/${otherUser?.id}`} className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar src={isGroup ? (chatData?.groupPhoto || null) : (otherUser?.photoURL || null)} name={getChatTitle()} size="sm" online={!isGroup && otherUser?.online} />
            <div className="min-w-0"><div className="font-medium truncate text-[var(--text-primary)]">{getChatTitle()}</div><div className="text-xs text-[var(--text-secondary)]">{isGroup ? `${chatData?.participants?.length || 0} участников` : (otherUser?.online ? 'Онлайн' : 'Был(а) недавно')}</div></div>
          </Link>
          <button onClick={() => setShowSidebar(!showSidebar)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-white/10 flex-shrink-0"><Info size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto transition-all duration-500" style={chatBackground ? { backgroundImage: `url(${chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'scroll', backgroundColor: 'rgba(0,0,0,0.5)', backgroundBlendMode: 'darken' } : {}}>
          <div className="flex flex-col justify-end min-h-full px-2 py-2">
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const isSameSender = prevMsg?.senderId === msg.senderId;
              const isMyMessage = msg.senderId === currentUser?.uid;
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }} id={`msg-${msg.id}`} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`} style={{ marginTop: isSameSender ? '1px' : '4px' }} onContextMenu={(e) => handleContextMenu(e, msg)}>
                  <div className={`max-w-[90%] ${isGroup && !isMyMessage ? 'ml-10' : ''}`}>
                    {isGroup && !isMyMessage && !isSameSender && <p className="text-xs text-blue-400 mb-0.5 ml-1">{msg.senderName || 'Пользователь'}</p>}
                    {msg.replyTo && <div className="text-xs text-[var(--text-secondary)] mb-0.5 ml-1 border-l-2 border-accent pl-2 italic">{msg.replyTo.text?.substring(0, 50)}{(msg.replyTo.text?.length || 0) > 50 ? '...' : ''}</div>}
                    <div className={`inline-block ${msg.isSticker ? '' : 'px-3 py-1.5 rounded-xl text-sm'} ${isMyMessage && !msg.isSticker ? 'bg-accent text-white rounded-br-sm' : !msg.isSticker ? 'glass text-[var(--text-primary)] rounded-bl-sm' : ''}`} style={{ maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {msg.isSticker ? (<span className="text-5xl leading-none">{msg.text}</span>) : msg.isVoice ? (
                        <div className="flex items-center gap-2 min-w-[180px] py-1">{msg.voiceUrl && msg.voiceUrl.startsWith('data:') ? (<><button onClick={(e) => { const audio = (e.target as HTMLElement).parentElement?.querySelector('audio') as HTMLAudioElement; if (audio) { if (audio.paused) { document.querySelectorAll('audio').forEach(a => a.pause()); audio.play(); } else { audio.pause(); } } }} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors flex-shrink-0">▶️</button><div className="flex-1 min-w-0"><div className="text-xs text-[var(--text-primary)] mb-0.5">🎤 Голосовое сообщение</div><audio src={msg.voiceUrl} className="hidden" preload="metadata" /><div className="flex items-center gap-2"><div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: '0%' }} /></div><span className="text-xs opacity-70 whitespace-nowrap">{msg.voiceDuration}с</span></div></div></>) : (<span className="text-xs opacity-50">🎤 Голосовое ({msg.voiceDuration}с)</span>)}</div>
                      ) : (<>{renderMessageText(msg.text, isMyMessage)}{msg.edited && <span className="text-[10px] opacity-50 ml-1">ред.</span>}</>)}
                    </div>
                    {(() => { const urlMatch = msg.text?.match(/(https?:\/\/[^\s]+)/i); if (urlMatch && linkPreviews[urlMatch[0]]) { const preview = linkPreviews[urlMatch[0]]; return (<a href={preview.url} target="_blank" rel="noopener noreferrer" className="block mt-2 rounded-xl overflow-hidden bg-white/5 hover:bg-white/10 transition-colors">{preview.image && <img src={preview.image} alt="" className="w-full h-32 object-cover" />}<div className="p-2"><div className="text-sm font-medium text-[var(--text-primary)] truncate">{preview.title}</div>{preview.description && <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{preview.description}</div>}<div className="text-xs text-accent truncate mt-0.5">{preview.url}</div></div></a>); } return null; })()}
                    {messageReactions[msg.id] && Object.keys(messageReactions[msg.id]).length > 0 && (<div className={`flex gap-1 mt-0.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>{Object.entries(messageReactions[msg.id]).map(([emoji, users]) => (<button key={emoji} onClick={() => handleMessageReaction(msg.id, emoji)} className="bg-white/10 hover:bg-white/20 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 transition-colors"><span>{emoji}</span><span className="text-[var(--text-secondary)]">{users.length}</span></button>))}</div>)}
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {replyTo && (<div className="px-3 py-2 border-t border-[var(--border-color)] bg-white/5 flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-xs text-accent mb-0.5">Ответ</p><p className="text-sm text-[var(--text-secondary)] truncate">{replyTo.text}</p></div><button onClick={() => setReplyTo(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={16} /></button></div>)}
        {editingMessage && (<div className="px-3 py-2 border-t border-[var(--border-color)] bg-yellow-500/10 flex items-center gap-3"><span className="text-xs text-yellow-400 flex-1">Редактирование: {editingMessage.text.substring(0, 30)}...</span><button onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={16} /></button></div>)}

        {blocked ? (<div className="p-4 text-center text-[var(--text-secondary)] text-sm border-t border-[var(--border-color)]">Вы не можете отправлять сообщения</div>) : isRecording ? (<div className="p-3 border-t border-[var(--border-color)] bg-red-500/10 backdrop-blur-xl flex items-center gap-3"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-sm text-[var(--text-primary)] flex-1">Запись... {recordingTime}с</span><button onClick={stopRecording} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-xl font-medium text-sm transition-colors">⏹️ Отправить</button></div>) : (<>{showStickers && (<div className="bg-[var(--bg-secondary)] backdrop-blur-xl border-t border-[var(--border-color)] p-3"><div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">{stickers.map(sticker => (<button key={sticker} onClick={() => sendSticker(sticker)} className="text-3xl hover:scale-125 transition-transform">{sticker}</button>))}</div></div>)}<form onSubmit={sendMessage} className="p-3 border-t border-[var(--border-color)] bg-white/5 backdrop-blur-xl flex gap-2"><button type="button" onClick={startRecording} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-lg">🎤</button><button type="button" onClick={() => setShowStickers(!showStickers)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-lg">😀</button><input type="text" value={newMessage} onChange={handleInputChange} placeholder={editingMessage ? 'Редактировать...' : 'Сообщение...'} className="flex-1 px-4 py-2 glass border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-accent text-sm" /><button type="submit" className="px-4 py-2 bg-accent hover:bg-[var(--accent-hover)] rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex-shrink-0" disabled={!newMessage.trim()}>{editingMessage ? 'Сохранить' : 'Отправить'}</button></form></>)}
      </div>

      {showSidebar && <ChatSidebar chatId={chatId!} otherUser={otherUser} chatData={chatData} onClose={() => setShowSidebar(false)} onScrollToMessage={scrollToMessage} onOpenWallpaper={() => setShowWallpaper(true)} />}

      {contextMenu.visible && (<div className="fixed bg-[#1a1a3e] rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden py-1" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px`, zIndex: 99999 }}>{contextMenu.isMyMessage && <button onClick={handleEdit} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/5 text-left flex items-center gap-2"><Pencil size={14} /> Редактировать</button>}<button onClick={handleReply} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/5 text-left flex items-center gap-2"><Reply size={14} /> Ответить</button><button onClick={handleForward} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/5 text-left flex items-center gap-2"><Forward size={14} /> Переслать</button><button onClick={() => { setShowMsgReactions(contextMenu.messageId); setContextMenu({ ...contextMenu, visible: false }); }} className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-white/5 text-left flex items-center gap-2">😊 Реакция</button>{(contextMenu.isMyMessage || isOwner || isAdmin) && <button onClick={handleDeleteMessage} className="w-full px-4 py-2 text-sm text-red-400 hover:bg-white/5 text-left flex items-center gap-2"><Trash2 size={14} /> Удалить</button>}</div>)}
      {showMsgReactions && (<div className="fixed inset-0 z-[99999] flex items-end justify-center pb-20" onClick={() => setShowMsgReactions(null)}><div className="bg-[#1a1a3e] rounded-2xl shadow-xl border border-[var(--border-color)] p-3 flex gap-2" onClick={e => e.stopPropagation()}>{['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (<button key={emoji} onClick={() => handleMessageReaction(showMsgReactions, emoji)} className="p-2 hover:bg-white/10 rounded-xl text-2xl transition-colors">{emoji}</button>))}</div></div>)}
      {showWallpaper && (<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowWallpaper(false)}><div className="bg-[#1a1a3e] rounded-2xl w-[95%] max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}><h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Обои чата</h3><div className="grid grid-cols-3 gap-3">{wallpapers.map(wp => (<button key={wp.value} onClick={() => { if (wp.value) localStorage.setItem(`chatBg_${chatId}`, wp.value); else localStorage.removeItem(`chatBg_${chatId}`); window.location.reload(); }} className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${chatBackground === wp.value ? 'border-accent' : 'border-transparent hover:border-white/30'}`}>{wp.value ? (<img src={wp.value} alt={wp.name} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-white/5 flex items-center justify-center text-xs text-[var(--text-secondary)]">{wp.name}</div>)}</button>))}</div></div></div>)}
    </div>
  );
};