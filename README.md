# InteriorAI - Система управления проектами ремонта

Приложение для архитекторов и компаний по ремонту квартир с AI-генерацией интерьеров, управлением проектами, сметами и системой ролей пользователей.

## Архитектура

- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (на Railway)
- **Deployment**: Railway (автодеплой с GitHub)

## Структура проекта

```
├── backend/              # Backend API сервер
│   ├── src/
│   │   ├── routes/      # API роуты
│   │   ├── middleware/  # Middleware (auth, permissions)
│   │   ├── config/      # Конфигурация (permissions)
│   │   ├── types/       # TypeScript типы
│   │   ├── db.ts        # Подключение к БД
│   │   └── index.ts     # Entry point
│   ├── migrations/      # SQL миграции
│   └── package.json
├── components/          # React компоненты
├── services/           # AI сервисы (Gemini, RouterAI)
├── types.ts            # Общие типы
└── package.json        # Frontend зависимости
```

## Локальная разработка

### Требования

- Node.js 18+
- PostgreSQL (локально или на Railway)
- API ключи для Gemini/RouterAI

### Настройка базы данных

1. Создайте PostgreSQL базу данных (локально или на Railway)
2. Скопируйте `backend/.env.example` в `backend/.env`
3. Заполните переменные окружения:

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Запуск бэкенда

```bash
cd backend
npm install
npm run migrate  # Применить миграции БД
npm run dev      # Запуск в режиме разработки
```

Бэкенд будет доступен на `http://localhost:5000`

### Запуск фронтенда

```bash
npm install
npm run dev
```

Фронтенд будет доступен на `http://localhost:3000`

Создайте файл `.env.local` в корне проекта:

```env
VITE_API_URL=http://localhost:5000
ROUTERAI_API_KEY=your-api-key
GEMINI_API_KEY=your-api-key
```

## Система ролей и прав

### Роли пользователей

- **admin** - Владелец компании, полный доступ ко всем функциям
- **manager** - Менеджер, управление проектами и пользователями
- **measurer** - Замерщик, создание проектов и использование AI
- **foreman** - Прораб, просмотр и редактирование смет
- **master** - Мастер, просмотр назначенных проектов
- **client** - Клиент, просмотр только своих объектов

### Права доступа

Права настраиваются администратором для каждой роли:
- `edit_prices` - Редактирование прайс-листов
- `view_all_projects` - Просмотр всех проектов организации
- `create_projects` - Создание новых проектов
- `create_users` - Создание пользователей
- `use_ai_generation` - Использование AI-генераций
- `view_estimates` - Просмотр смет
- `edit_estimates` - Редактирование смет
- `manage_settings` - Управление настройками
- `manage_permissions` - Управление правами доступа

## API Endpoints

### Авторизация

- `POST /auth/register-admin` - Регистрация первого администратора и организации
- `POST /auth/login` - Вход в систему

### Пользователи (требуется auth)

- `GET /users` - Список пользователей организации (admin/manager)
- `POST /users` - Создание пользователя (admin)
- `PATCH /users/:id` - Обновление пользователя (admin)
- `DELETE /users/:id` - Удаление пользователя (admin)

### Права доступа (требуется auth)

- `GET /permissions` - Получить права по ролям (admin)
- `PATCH /permissions` - Изменить право для роли (admin)

### Проекты (требуется auth)

- `GET /projects` - Список проектов (фильтруется по ролям)
- `GET /projects/:id` - Получить проект
- `POST /projects` - Создать проект
- `PATCH /projects/:id` - Обновить проект

### AI генерации (требуется auth)

- `GET /ai/limit` - Получить информацию о лимитах AI
- `POST /ai/analyze-plan` - Анализ плана помещения
- `POST /ai/generate-room` - Генерация интерьера комнаты
- `POST /ai/generate-isometric` - Генерация изометрического вида

## Деплой на Railway

### Подготовка

1. Убедитесь, что проект находится в GitHub репозитории
2. Добавьте `.env` файлы в `.gitignore` (уже добавлено)

### Настройка PostgreSQL на Railway

1. В Railway создайте новый проект
2. Добавьте PostgreSQL ресурс
3. Скопируйте `DATABASE_URL` из настроек PostgreSQL

### Настройка бэкенда на Railway

1. Создайте новый сервис из GitHub репозитория
2. В настройках сервиса:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run migrate && npm start`
3. Добавьте переменные окружения:
   - `DATABASE_URL` - из PostgreSQL ресурса
   - `JWT_SECRET` - случайная строка для подписи токенов
   - `NODE_ENV=production`
   - `FRONTEND_URL` - URL фронтенда (будет известен после деплоя)
   - `ROUTERAI_API_KEY` или `GEMINI_API_KEY` - API ключи
4. Railway автоматически применит миграции при старте

### Настройка фронтенда на Railway

1. Создайте второй сервис из того же GitHub репозитория
2. В настройках сервиса:
   - **Root Directory**: `.` (корень проекта)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview` (или используйте статический хостинг)
3. Добавьте переменные окружения:
   - `VITE_API_URL` - публичный URL бэкенда Railway
   - `ROUTERAI_API_KEY` или `GEMINI_API_KEY` - API ключи
4. Railway автоматически деплоит при пуше в `main` ветку

### Автодеплой

Railway автоматически деплоит при каждом push в `main` ветку GitHub репозитория.

## Первый запуск

1. После деплоя бэкенда, зарегистрируйте первого администратора:

```bash
POST https://your-backend.railway.app/auth/register-admin
{
  "email": "admin@example.com",
  "password": "secure-password",
  "name": "Admin User",
  "organizationName": "My Company"
}
```

2. Войдите в систему через фронтенд или API
3. Создайте пользователей через админ-панель

## Лимиты AI генераций

Каждая организация имеет лимит на количество AI-генераций:
- По умолчанию: 100 генераций
- Администратор может изменить лимит в настройках организации
- Лимит проверяется перед каждой генерацией
- Использованные генерации отслеживаются автоматически

## Безопасность

- Пароли хешируются с помощью bcrypt
- JWT токены с истечением срока действия (7 дней)
- Проверка прав доступа на уровне middleware
- CORS настроен только для разрешенных доменов
- Валидация входных данных с помощью Zod

## Разработка

### Структура бэкенда

- `src/routes/` - API роуты
- `src/middleware/` - Middleware для авторизации и проверки прав
- `src/config/` - Конфигурация (права по умолчанию)
- `src/types/` - TypeScript типы
- `migrations/` - SQL миграции для БД

### Добавление новых миграций

```bash
cd backend
# Создайте файл в migrations/ с именем 002_description.sql
# Примените миграции: npm run migrate
```

## Лицензия

Private
