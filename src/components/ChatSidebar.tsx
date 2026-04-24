// ChatSidebar.tsx
import React, { useEffect, useState, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, doc, updateDoc, arrayRemove, arrayUnion, deleteDoc, getDoc } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { X, Image, FileText, Users, Bell, Ban, Link2, Mic, User, ExternalLink, Crown, Shield, Camera, Pencil, UserMinus, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatSidebarProps {
  chatId: string;
  otherUser?: any;
  chatData?: any;
  onClose: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ chatId, otherUser, chatData, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'files' | 'links' | 'voice'>('info');
  const [media, setMedia] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [voiceMessages, setVoiceMessages] = useState<any[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [avatarLightbox, setAvatarLightbox] = useState(false);
  const [groupUsers, setGroupUsers] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  const isGroup = chatData?.isGroup || false;
  const isOwner = chatData?.createdBy === currentUser?.uid;
  const isAdmin = chatData?.admins?.includes(currentUser?.uid) || false;
  const canEdit = isOwner || isAdmin;

  useEffect(() => {
    loadSharedData();
    if (isGroup) loadGroupUsers();
  }, [chatId]);

  const loadSharedData = async () => {
    try {
      const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTotalMessages(allMessages.length);
      setMedia(allMessages.filter((msg: any) => msg.media && msg.media.length > 0));
      setFiles(allMessages.filter((msg: any) => (msg.text || '').match(/\.(pdf|doc|docx|xls|xlsx|zip|rar|txt|apk|exe)$/i)));
      setLinks(allMessages.filter((msg: any) => (msg.text || '').match(/https?:\/\/[^\s]+/i)));
      setVoiceMessages(allMessages.filter((msg: any) => msg.isVoice));
    } catch (error) { console.error('Ошибка загрузки данных:', error); }
  };

  const loadGroupUsers = async () => {
    if (!chatData?.participants) return;
    try {
      const usersData = await Promise.all(
        chatData.participants.map(async (uid: string) => {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: uid,
              displayName: userData.displayName || 'Пользователь',
              photoURL: userData.photoURL || null,
              online: userData.online || false,
              role: uid === chatData.createdBy ? 'owner' : chatData.admins?.includes(uid) ? 'admin' : 'member'
            };
          }
          return null;
        })
      );
      setGroupUsers(usersData.filter(Boolean));
    } catch (error) { console.error('Ошибка загрузки участников:', error); }
  };

  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('https://api.imgbb.com/1/upload?key=твой_ключ', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) {
        await updateDoc(doc(db, 'chats', chatId), { groupPhoto: data.data.url });
        if (chatData) chatData.groupPhoto = data.data.url;
        loadGroupUsers();
      }
    } catch (error) { console.error('Ошибка загрузки фото:', error); }
    finally { setUploadingPhoto(false); }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown size={10} /> Владелец</span>;
      case 'admin': return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield size={10} /> Админ</span>;
      default: return <span className="text-xs text-[var(--text-secondary)]">Участник</span>;
    }
  };

  const promoteToAdmin = async (userId: string) => {
    if (!isOwner) return;
    await updateDoc(doc(db, 'chats', chatId), { admins: arrayUnion(userId) });
    loadGroupUsers();
  };

  const demoteFromAdmin = async (userId: string) => {
    if (!isOwner) return;
    await updateDoc(doc(db, 'chats', chatId), { admins: arrayRemove(userId) });
    loadGroupUsers();
  };

  const removeMember = async (userId: string) => {
    if (!canEdit || userId === chatData?.createdBy) return;
    if (!window.confirm('Удалить участника из группы?')) return;
    await updateDoc(doc(db, 'chats', chatId), { participants: arrayRemove(userId) });
    loadGroupUsers();
  };

  const leaveGroup = async () => {
    if (!window.confirm('Выйти из группы?')) return;
    if (isOwner) {
      await deleteDoc(doc(db, 'chats', chatId));
      navigate('/messages');
    } else {
      await updateDoc(doc(db, 'chats', chatId), { participants: arrayRemove(currentUser!.uid) });
      navigate('/messages');
    }
  };

  const saveGroupInfo = async () => {
    if (!canEdit || !editName.trim()) return;
    await updateDoc(doc(db, 'chats', chatId), { groupName: editName.trim() });
    setEditMode(false);
    loadGroupUsers();
  };

  const tabs = [
    { key: 'info', label: 'Инфо', icon: Users },
    { key: 'media', label: 'Медиа', icon: Image },
    { key: 'files', label: 'Файлы', icon: FileText },
    { key: 'links', label: 'Ссылки', icon: Link2 },
    { key: 'voice', label: 'Войсы', icon: Mic },
  ];

  return (
    <div className="w-full md:w-96 bg-black/30 border-l border-[var(--border-color)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 className="font-bold text-[var(--text-primary)] text-lg">Информация</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-secondary)]"><X size={20} /></button>
      </div>

      <div className="p-5 text-center border-b border-[var(--border-color)]">
        {isGroup ? (
          <>
            <div className="relative inline-block">
              <button onClick={() => chatData?.groupPhoto && setAvatarLightbox(true)} className="cursor-pointer">
                <Avatar src={chatData?.groupPhoto || null} name={chatData?.groupName || 'G'} size="lg" />
              </button>
              {canEdit && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="absolute bottom-0 right-0 p-1.5 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors" title="Изменить фото группы">
                    {uploadingPhoto ? <span className="text-xs animate-pulse">...</span> : <Camera size={14} />}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleGroupPhotoUpload} />
                </>
              )}
            </div>
            {editMode ? (
              <div className="mt-3 space-y-2">
                <input type="text" value={editName || chatData?.groupName || ''} onChange={(e) => setEditName(e.target.value)} placeholder="Название группы" className="w-full px-3 py-2 bg-white/10 rounded-xl text-center text-[var(--text-primary)] text-sm focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={saveGroupInfo} className="flex-1 py-1.5 bg-blue-500 rounded-lg text-white text-sm">Сохранить</button>
                  <button onClick={() => setEditMode(false)} className="flex-1 py-1.5 bg-white/10 rounded-lg text-[var(--text-primary)] text-sm">Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="mt-3 font-bold text-[var(--text-primary)] text-lg">{chatData?.groupName || 'Группа'}</h4>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{chatData?.participants?.length || 0} участников</p>
                {canEdit && (
                  <button onClick={() => { setEditName(chatData?.groupName || ''); setEditMode(true); }} className="mt-2 text-xs text-blue-400 hover:underline flex items-center justify-center gap-1">
                    <Pencil size={12} /> Редактировать название
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button onClick={() => otherUser?.photoURL && setAvatarLightbox(true)} className="cursor-pointer">
              <Avatar src={otherUser?.photoURL} name={otherUser?.displayName} size="lg" />
            </button>
            <h4 className="mt-3 font-bold text-[var(--text-primary)] text-lg">{otherUser?.displayName || 'Пользователь'}</h4>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{otherUser?.online ? '🟢 В сети' : '⚫ Не в сети'}</p>
            <button onClick={() => navigate(`/profile/${otherUser?.id}`)} className="mt-3 w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium text-[var(--text-primary)] transition-colors flex items-center justify-center gap-2">
              <User size={16} /> Открыть профиль <ExternalLink size={14} />
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2 p-3 border-b border-[var(--border-color)]">
        <button className="flex-1 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-500/30 transition-colors"><Bell size={16} className="inline mr-1" /> Уведомления</button>
        {isGroup ? (
          <button onClick={leaveGroup} className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors"><LogOut size={16} className="inline mr-1" /> Выйти</button>
        ) : (
          <button className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors"><Ban size={16} className="inline mr-1" /> Блокировать</button>
        )}
      </div>

      <div className="flex border-b border-[var(--border-color)] px-3">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === tab.key ? 'text-blue-400 border-b-2 border-blue-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            {isGroup ? (
              <>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wide">Участники ({groupUsers.length})</p>
                  <div className="space-y-1">
                    {groupUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
                        <Avatar src={u.photoURL} name={u.displayName} size="sm" online={u.online} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-[var(--text-primary)] truncate">{u.displayName}</div>
                          <div className="text-xs">{getRoleBadge(u.role)}</div>
                        </div>
                        {canEdit && u.id !== currentUser?.uid && (
                          <div className="flex gap-1">
                            {u.role === 'member' && isOwner && (
                              <button onClick={() => promoteToAdmin(u.id)} className="p-1 text-blue-400 hover:bg-blue-400/10 rounded" title="Сделать админом"><Shield size={14} /></button>
                            )}
                            {u.role === 'admin' && isOwner && (
                              <button onClick={() => demoteFromAdmin(u.id)} className="p-1 text-yellow-400 hover:bg-yellow-400/10 rounded" title="Понизить"><Crown size={14} /></button>
                            )}
                            <button onClick={() => removeMember(u.id)} className="p-1 text-red-400 hover:bg-red-400/10 rounded" title="Удалить"><UserMinus size={14} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[var(--border-color)] pt-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Статистика</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{totalMessages}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Сообщений</div></div>
                    <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{media.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Медиа</div></div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div><p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-wide">Имя</p><p className="text-sm text-[var(--text-primary)] font-medium">{otherUser?.displayName || 'Не указано'}</p></div>
                <div><p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-wide">Статус</p><p className="text-sm text-[var(--text-primary)] font-medium">{otherUser?.online ? '🟢 В сети' : '⚫ Не в сети'}</p></div>
                <div className="border-t border-[var(--border-color)] pt-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Статистика переписки</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{totalMessages}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Сообщений</div></div>
                    <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{media.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Медиа</div></div>
                    <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{files.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Файлов</div></div>
                    <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[var(--text-primary)]">{links.length}</div><div className="text-xs text-[var(--text-secondary)] mt-1">Ссылок</div></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'media' && (media.length === 0 ? <p className="text-sm text-[var(--text-secondary)] text-center py-8">Нет медиа</p> : <div className="grid grid-cols-3 gap-2">{media.map((item: any) => (<div key={item.id} className="aspect-square rounded-lg overflow-hidden bg-white/5">{item.media?.[0]?.url && <img src={item.media[0].url} alt="" className="w-full h-full object-cover" />}</div>))}</div>)}

        {activeTab === 'files' && (files.length === 0 ? <p className="text-sm text-[var(--text-secondary)] text-center py-8">Нет файлов</p> : <div className="space-y-2">{files.map((item: any) => (<div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"><FileText size={18} className="text-blue-400 flex-shrink-0" /><span className="text-sm text-[var(--text-primary)] truncate">{item.text}</span></div>))}</div>)}

        {activeTab === 'links' && (links.length === 0 ? <p className="text-sm text-[var(--text-secondary)] text-center py-8">Нет ссылок</p> : <div className="space-y-3">{links.map((item: any) => { const urlMatch = item.text?.match(/(https?:\/\/[^\s]+)/i); const url = urlMatch ? urlMatch[0] : item.text; const textWithoutUrl = item.text?.replace(url, '').trim(); return (<a key={item.id} href={url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"><div className="flex items-center gap-2 mb-1"><Link2 size={16} className="text-green-400 flex-shrink-0" /><span className="text-sm text-blue-400 truncate hover:underline">{url}</span></div>{textWithoutUrl && <p className="text-xs text-[var(--text-secondary)] truncate ml-7">{textWithoutUrl}</p>}</a>); })}</div>)}

        {activeTab === 'voice' && (voiceMessages.length === 0 ? <p className="text-sm text-[var(--text-secondary)] text-center py-8">Нет голосовых сообщений</p> : <div className="space-y-2">{voiceMessages.map((item: any) => (<div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5"><Mic size={18} className="text-purple-400 flex-shrink-0" /><span className="text-sm text-[var(--text-primary)]">Голосовое сообщение</span></div>))}</div>)}
      </div>

      {(avatarLightbox && (otherUser?.photoURL || chatData?.groupPhoto)) && (
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAvatarLightbox(false)}>
          <button onClick={() => setAvatarLightbox(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={24} /></button>
          <img src={otherUser?.photoURL || chatData?.groupPhoto} alt="" className="max-w-[90%] max-h-[90%] object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};