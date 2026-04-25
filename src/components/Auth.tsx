import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateUsername = (base: string): string => {
    const clean = base.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${clean}_${randomSuffix}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Валидация
        if (!displayName.trim()) {
          throw new Error('Имя обязательно');
        }

        // Создаём пользователя
        const { user } = await createUserWithEmailAndPassword(auth, email, password);

        // Генерируем username, если не введён
        let finalUsername = username.trim();
        if (!finalUsername) {
          finalUsername = generateUsername(displayName);
        }

        // Проверяем уникальность username (упрощённо)
        // В реальном проекте нужно проверять через Firestore

        // Обновляем профиль
        await updateProfile(user, { displayName });

        // Сохраняем в Firestore
        await setDoc(doc(db, 'users', user.uid), {
          displayName,
          email,
          photoURL: null,
          createdAt: new Date(),
        });

        await setDoc(doc(db, 'usernames', user.uid), {
          username: finalUsername,
          userId: user.uid,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          {isLogin ? 'Вход' : 'Регистрация'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Имя"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                required={!isLogin}
              />
              <input
                type="text"
                placeholder="@username (необязательно)"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent text-white rounded-xl font-medium"
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="mt-4 text-center text-[#AAAAAA]">
          {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-accent hover:underline">
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
};
