// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface AuthState {
  user: any;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Пользователь вошёл — ставим онлайн
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            online: true,
            lastSeen: Timestamp.now()
          });
        } catch (error) {
          console.error('Ошибка обновления статуса онлайн:', error);
        }

        // Проверяем, админ ли
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch {
          setIsAdmin(false);
        }

        setUser(firebaseUser);
      } else {
        // Пользователь вышел — ставим офлайн
        if (user) {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              online: false,
              lastSeen: Timestamp.now()
            });
          } catch (error) {
            console.error('Ошибка обновления статуса офлайн:', error);
          }
        }

        setIsAdmin(false);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // При размонтировании (закрытие вкладки) — ставим офлайн
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            online: false,
            lastSeen: Timestamp.now()
          });
        } catch (error) {
          console.error('Ошибка обновления статуса при выходе:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};