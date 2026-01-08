# Инструкция по деплою на Railway

## Быстрый старт

### 1. Подготовка репозитория

Убедитесь, что проект находится в GitHub репозитории и все изменения закоммичены.

### 2. Создание PostgreSQL на Railway

1. Зайдите на [Railway](https://railway.app)
2. Создайте новый проект
3. Добавьте PostgreSQL ресурс (New → Database → Add PostgreSQL)
4. Скопируйте `DATABASE_URL` из настроек PostgreSQL (Variables → DATABASE_URL)

### 3. Деплой бэкенда

1. В Railway создайте новый сервис:
   - New → GitHub → Выберите ваш репозиторий
   - В настройках сервиса:
     - **Root Directory**: `backend`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run migrate && npm start`

2. Добавьте переменные окружения (Variables):
   ```
   DATABASE_URL=<из PostgreSQL ресурса>
   JWT_SECRET=<случайная строка, минимум 32 символа>
   NODE_ENV=production
   PORT=5000
   FRONTEND_URL=<будет известен после деплоя фронтенда>
   ROUTERAI_API_KEY=<ваш API ключ>
   GEMINI_API_KEY=<ваш API ключ>
   ```

3. Railway автоматически применит миграции при первом запуске

### 4. Деплой фронтенда

1. Создайте второй сервис из того же репозитория:
   - New → GitHub → Выберите ваш репозиторий
   - В настройках сервиса:
     - **Root Directory**: `.` (корень проекта)
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run preview -- --port $PORT --host 0.0.0.0`

2. Добавьте переменные окружения:
   ```
   VITE_API_URL=<публичный URL бэкенда Railway>
   ROUTERAI_API_KEY=<ваш API ключ>
   GEMINI_API_KEY=<ваш API ключ>
   ```

3. После деплоя скопируйте публичный URL фронтенда и обновите `FRONTEND_URL` в переменных окружения бэкенда

### 5. Первый запуск

1. Откройте фронтенд в браузере
2. Зарегистрируйте первого администратора через форму регистрации (если есть) или через API:

```bash
POST https://your-backend.railway.app/auth/register-admin
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "secure-password-here",
  "name": "Admin User",
  "organizationName": "My Company"
}
```

3. Войдите в систему и создайте пользователей через раздел "Настройки"

## Автодеплой

Railway автоматически деплоит при каждом push в `main` ветку GitHub.

## Проверка работоспособности

- Бэкенд: `https://your-backend.railway.app/health` должен вернуть `{"status":"ok","database":"connected"}`
- Фронтенд: должен открываться и показывать экран логина

## Устранение проблем

### Бэкенд не запускается

1. Проверьте логи в Railway (Deployments → View Logs)
2. Убедитесь, что все переменные окружения установлены
3. Проверьте, что `DATABASE_URL` корректный

### Миграции не применяются

1. Запустите миграции вручную через Railway CLI или через один из деплоев:
   ```bash
   railway run npm run migrate
   ```

### Фронтенд не может подключиться к бэкенду

1. Проверьте `VITE_API_URL` в переменных окружения фронтенда
2. Убедитесь, что `FRONTEND_URL` в бэкенде совпадает с URL фронтенда
3. Проверьте CORS настройки в бэкенде

## Обновление

Просто сделайте push в `main` ветку - Railway автоматически задеплоит изменения.

