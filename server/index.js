    // server/index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

// Включаем CORS, чтобы React мог обращаться к этому серверу
app.use(cors());

// Папка, куда будем сохранять загруженные файлы
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Настройка multer: куда и как сохранять файлы
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя, чтобы не было конфликтов
    const ext = path.extname(file.originalname);
    const uniqueName = uuidv4() + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Отдаём статические файлы из папки uploads
app.use('/uploads', express.static(uploadDir));

// Эндпоинт для загрузки одного файла (ожидает поле "image")
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  // Формируем полный URL для доступа к файлу
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.listen(PORT, () => {
  console.log(`Сервер загрузок запущен на http://localhost:${PORT}`);
});