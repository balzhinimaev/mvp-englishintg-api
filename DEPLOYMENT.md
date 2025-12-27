# Инструкция по развертыванию на VPS

Это руководство поможет вам развернуть проект Burlive API на VPS сервере с использованием Docker.

## Предварительные требования

- VPS сервер с Ubuntu 20.04+ (или другой Linux дистрибутив)
- SSH доступ к серверу
- Установленный Docker и Docker Compose
- Домен (опционально, для настройки Nginx)

## Шаг 1: Подготовка сервера

### Установка Docker и Docker Compose

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker (чтобы не использовать sudo)
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезагрузка сессии (или выйдите и войдите снова)
newgrp docker
```

### Установка Git (если не установлен)

```bash
sudo apt install git -y
```

## Шаг 2: Клонирование проекта

```bash
# Переход в домашнюю директорию
cd ~

# Клонирование репозитория
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> burlive
cd burlive
```

## Шаг 3: Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
nano .env
```

Добавьте следующие переменные (замените значения на свои):

```env
# Окружение
NODE_ENV=production
PORT=7777

# База данных
MONGODB_URI=mongodb://mongodb:27017
MONGODB_DB_NAME=englishintg

# Аутентификация (ОБЯЗАТЕЛЬНО)
JWT_SECRET=ваш-секретный-ключ-минимум-32-символа-длинный
TELEGRAM_BOT_TOKEN=ваш-токен-телеграм-бота

# Платежи YooKassa (опционально)
# YOOKASSA_SHOP_ID=123456
# YOOKASSA_SECRET_KEY=live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# YOOKASSA_API_URL=https://api.yookassa.ru/v3
# SELF_EMPLOYED_INN=123456789012

# API бота (опционально)
# BOT_API_URL=https://your-bot-api-domain.com
# BOT_API_KEY=your-bot-api-key-here
```

**Важно:**
- `JWT_SECRET` должен быть минимум 32 символа. Сгенерировать можно командой:
  ```bash
  openssl rand -base64 32
  ```
- `TELEGRAM_BOT_TOKEN` можно получить у [@BotFather](https://t.me/BotFather) в Telegram

Сохраните файл (Ctrl+O, Enter, Ctrl+X в nano).

## Шаг 4: Сборка и запуск контейнеров

```bash
# Сборка образа приложения
docker-compose build

# Запуск контейнеров в фоновом режиме
docker-compose up -d

# Проверка статуса контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs -f app
```

## Шаг 5: Проверка работы

```bash
# Проверка здоровья приложения
curl http://localhost:7777/health

# Или через браузер откройте:
# http://ВАШ_IP:7777/health
```

## Шаг 6: Настройка Nginx (опционально, для домена)

Если у вас есть домен, настройте Nginx как reverse proxy:

### Установка Nginx

```bash
sudo apt install nginx -y
```

### Создание конфигурации

```bash
sudo nano /etc/nginx/sites-available/burlive
```

Добавьте следующую конфигурацию (замените `your-domain.com` на ваш домен):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:7777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/burlive /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Настройка SSL с Let's Encrypt (рекомендуется)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Управление приложением

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Только приложение
docker-compose logs -f app

# Только MongoDB
docker-compose logs -f mongodb
```

### Остановка приложения

```bash
docker-compose down
```

### Перезапуск приложения

```bash
docker-compose restart
```

### Обновление приложения

```bash
# Получение последних изменений
git pull

# Пересборка и перезапуск
docker-compose build
docker-compose up -d
```

### Очистка (удаление контейнеров и volumes)

```bash
# Остановка и удаление контейнеров
docker-compose down

# Удаление с volumes (ВНИМАНИЕ: удалит все данные БД!)
docker-compose down -v
```

## Резервное копирование MongoDB

### Создание бэкапа

```bash
# Создание директории для бэкапов
mkdir -p ~/backups

# Создание бэкапа
docker exec burlive-mongodb mongodump --out /data/backup
docker cp burlive-mongodb:/data/backup ~/backups/backup-$(date +%Y%m%d-%H%M%S)
```

### Восстановление из бэкапа

```bash
# Копирование бэкапа в контейнер
docker cp ~/backups/backup-YYYYMMDD-HHMMSS burlive-mongodb:/data/restore

# Восстановление
docker exec burlive-mongodb mongorestore /data/restore
```

## Мониторинг

### Проверка использования ресурсов

```bash
docker stats
```

### Проверка места на диске

```bash
docker system df
```

### Очистка неиспользуемых ресурсов

```bash
docker system prune -a
```

## Безопасность

1. **Firewall**: Настройте UFW для ограничения доступа:
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **Обновления**: Регулярно обновляйте систему и Docker образы:
   ```bash
   sudo apt update && sudo apt upgrade -y
   docker-compose pull
   docker-compose up -d
   ```

3. **Секреты**: Никогда не коммитьте файл `.env` в репозиторий.

## Решение проблем

### Приложение не запускается

```bash
# Проверьте логи
docker-compose logs app

# Проверьте переменные окружения
docker-compose config
```

### MongoDB не подключается

```bash
# Проверьте статус MongoDB
docker-compose ps mongodb

# Проверьте логи MongoDB
docker-compose logs mongodb

# Проверьте подключение из контейнера приложения
docker exec burlive-api ping mongodb
```

### Порт уже занят

Если порт 7777 занят, измените его в `docker-compose.yml`:

```yaml
ports:
  - "8080:7777"  # Внешний порт:внутренний порт
```

И обновите переменную `PORT` в `.env` если нужно.

## Полезные команды

```bash
# Вход в контейнер приложения
docker exec -it burlive-api sh

# Вход в MongoDB shell
docker exec -it burlive-mongodb mongosh

# Просмотр переменных окружения контейнера
docker exec burlive-api env
```

## Поддержка

При возникновении проблем проверьте:
1. Логи контейнеров: `docker-compose logs`
2. Статус контейнеров: `docker-compose ps`
3. Конфигурацию: `docker-compose config`
4. Документацию по переменным окружения: `ENV_VARIABLES.md`

