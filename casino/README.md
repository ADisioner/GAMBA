# GAMBA — Premium Multiplayer Casino 🎰

Полноценная платформа симулятора казино с поддержкой мультиплеера в реальном времени.

## ✨ Особенности
- **Мультиплеер**: Играйте в Блэкджек и Видео-Покер с друзьями или другими игроками через Firebase Realtime Database.
- **Игры**: 
  - Блэкджек (Мультиплеер + Соло)
  - Видео-Покер (Мультиплеер + Соло)
  - Слоты (Golden Slots)
  - Рулетка
  - Crash
  - Mines
- **Система Удачи (Luck)**: Динамический расчет вероятностей на основе истории игр.
- **Профили**: Кастомизация аватаров, отслеживание статистики и достижений.
- **Живая лента**: Отображение ставок всех игроков в режиме реального времени.
- **Админ-панель**: Управление конфигурацией игр и статистикой.

## 🛠 Технологический стек
- **Frontend**: React 19, Vite, Tailwind CSS (v4)
- **Backend/DB**: Firebase (Auth, Firestore, Realtime Database)
- **State**: React Context API
- **Animations**: Framer Motion, Lucide React icons

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка Firebase
Создайте проект в [Firebase Console](https://console.firebase.google.com/) и включите следующие сервисы:
- Authentication (Email/Password, Anonymous)
- Firestore Database
- Realtime Database

### 3. Конфигурация (.env)
Создайте файл `.env` в корневом каталоге и добавьте ваши ключи:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
```

### 4. Запуск локально
```bash
npm run dev
```

## 📜 Правила безопасности
Для корректной работы мультиплеера и базы данных необходимо применить правила из файлов `firestore.rules` и `database.rules.json` в консоли Firebase.
