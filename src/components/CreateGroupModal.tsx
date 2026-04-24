// CreateGroupModal.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { Avatar } from './Avatar';
import { X, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateGroupModalProps {
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'friends'),
      where('participants', 'array-contains', currentUser.uid),
      where('status', '==', 'accepted')
    );
    const snapshot = await getDocs(q);
    const friendsData = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const friendId = data.requesterId === currentUser.uid ? data.receiverId : data.requesterId;
        const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', friendId)));
        if (!userDoc.empty) {
          return { id: friendId, ...userDoc.docs[0].data() };
        }
        return null;
      })
    );
    setFriends(friendsData.filter(Boolean));
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!currentUser) return;
    if (selectedUsers.length < 2) {
      alert('Выберите хотя бы 2 участников');
      return;
    }
    if (!groupName.trim()) {
      alert('Введите название группы');
      return;
    }

    setLoading(true);
    try {
      const participants = [currentUser.uid, ...selectedUsers];
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants,
        groupName: groupName.trim(),
        isGroup: true,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      onClose();
      navigate(`/messages/${chatRef.id}`);
    } catch (error) {
      console.error('Ошибка создания группы:', error);
      alert('Не удалось создать группу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-heavy rounded-2xl w-[95%] max-w-md max-h-[80vh] overflow-y-auto shadow-2xl z-10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Users size={20} className="text-blue-400" />
              Новая группа
            </h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-secondary)]">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Название группы"
              className="w-full px-4 py-3 bg-white/10 rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none"
            />

            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Выбрано: {selectedUsers.length} участников
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {friends.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => toggleUser(friend.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      selectedUsers.includes(friend.id)
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <Avatar src={friend.photoURL} name={friend.displayName} size="sm" />
                    <span className="text-sm text-[var(--text-primary)]">{friend.displayName}</span>
                    {selectedUsers.includes(friend.id) && (
                      <span className="ml-auto text-blue-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || selectedUsers.length < 2 || !groupName.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium text-white disabled:opacity-50 transition-colors"
            >
              {loading ? 'Создание...' : 'Создать группу'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};