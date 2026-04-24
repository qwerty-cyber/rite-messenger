// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Твой объект конфигурации (проверь appId!)
const firebaseConfig = {
  apiKey: "AIzaSyC83wbD_y-_wwePEDXsN0Y2ldG65BqaPr0",
  authDomain: "my-telegram-clone-91e62.firebaseapp.com",
  projectId: "my-telegram-clone-91e62",
  storageBucket: "my-telegram-clone-91e62.firebasestorage.app",
  messagingSenderId: "777103142391",
  appId: "1:777103142391:web:df69b8dc6f8d9ddff892f2",
  measurementId: "G-S1LMZJ4JC3"
};


// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Экспорт нужных сервисов
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);