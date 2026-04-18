# discordbot

## PM2 запуск и автозапуск при старте Windows (WSL)

### 1) Подготовка

В `.env` должны быть заполнены рабочие значения:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `POSTGRES_*`

Для функционала `membercheck` обязательно включите в Discord Developer Portal:

- `SERVER MEMBERS INTENT`
- `MESSAGE CONTENT INTENT`

### 2) Установка PM2 (внутри WSL)

```bash
npm install -g pm2
pm2 -v
```

### 3) Первый запуск бота в PM2

```bash
yarn build
yarn pm2:start
pm2 save
pm2 startup
pm2 ls
```

Для текущего окружения WSL `pm2 startup` выдаёт команду вида:

```bash
sudo env "PATH=$PATH:/home/ga1eta/.nvm/versions/node/v20.19.6/bin" /home/ga1eta/.nvm/versions/node/v20.19.6/lib/node_modules/pm2/bin/pm2 startup systemd -u ga1eta --hp /home/ga1eta
```

Выполните её один раз и затем снова сделайте `pm2 save`.

Логи:

```bash
yarn pm2:logs
```

### 4) Проверка/обновление после изменений

```bash
git pull
yarn install
yarn build
yarn pm2:restart
```

### 5) Автозапуск при старте Windows

В репозитории есть bootstrap-скрипт: `scripts/wsl-pm2-bootstrap.sh`.

Он делает:

1. `docker compose up -d postgres`
2. `yarn build`
3. `pm2 start ecosystem.config.cjs --env production` (или `pm2 restart discordbot --update-env`)
4. `pm2 save`

#### Настройка через Task Scheduler (Windows)

Создайте задачу, которая запускается `At log on` или `At startup`.

- **Program/script**:
  `C:\Windows\System32\wsl.exe`
- **Add arguments**:
  `-d Ubuntu --cd /var/www/discordbot --exec bash scripts/wsl-pm2-bootstrap.sh`

После этого при старте Windows поднимется WSL, затем postgres-контейнер и процесс `discordbot` в PM2.

### 6) Файлы конфигурации

- PM2 ecosystem: `ecosystem.config.cjs`
- WSL bootstrap: `scripts/wsl-pm2-bootstrap.sh`
