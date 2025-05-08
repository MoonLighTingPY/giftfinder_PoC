# Пошук Подарунків

## 🧩 Опис проєкту
Цей проект — веб-додаток для підбору та генерації подарунків на основі введених користувачем критеріїв за допомогою ШІ.  
Він складається з фронтенда на React + JS та бекенда на Express + MySQL. Цей проект:

- Збирає інформацію про отримувача: вік, стать, бюджет, інтереси/хобі, професію, привід.  
- Повертає рекомендації з бази даних (`gifts`), що підходять під критерії.  
- За допомогою ШІ генерує унікальні ідеї подарунків  

## ⭐️ Особливості

- JWT-автентифікація (`jsonwebtoken`)
- Очистка дублікатів подарунків кожні 15 хв: ````src/api/duplicateCleaner.js````
- Перевірка присутності зображень у подарунків в БД кожні 15 хв: ````src/api/server.js````
- Переклад назв для зображень на англійську + кешування
- Groq Cloud API для генерації та відбору подарунків
- React + Redux Toolkit + redux-persist
- Автоматично очищує дублікати подарунків і періодично оновлює записи без зображень.  

---

## 🔗 Використані API

1. **Pexels API** — ````getImageUrl в src/services/pexelsService.js````
   - Для пошуку зображень за назвою подарунка

2. **Google Translate API** — ````translateToEnglish в src/services/pexelsService.js````
   - Для перекладу українських назв перед запитом до Pexels

3. **Groq Cloud API** — ````generateCompletion в src/services/aiService.js````
   - Вибір найкращих подарунків з БД
   - Генерація нових подарунків і додавання їх в БД з прапорцем ai_generated = 1
   - Переклад (на випадок, якщо Google Translate досяг ліміту)

4. **MySQL** — ````mysql2/promise````
   - База даних: користувачі, подарунки, теги(для віку, статі, бюджетів та іншого)

---

## 🧱 Стек

- **Фронтенд:** React 18, Vite, React Router, Redux Toolkit, CSS Modules
- **Бекенд:** Node.js 20 (LTS), Express 5, MySQL, JWT, bcrypt
- **ШІ:** Groq Cloud API
- **Переклад:** @vitalets/google-translate-api + Grog Cloud як fallback
- **Кешування:** `Map` у пам’яті

---

## 🛠 Передумови

- Node.js >= 20
- npm
- MySQL
- Файл `.env` у корені проєкту

---

## ⚙️ Встановлення

1. Клонувати репозиторій:
   ````
   git clone <repo-url>
   cd <repo-folder>
   ````

2. Встановити залежності:
   ````
   npm install
   ````

3. Створити `.env` файл:


```
VITE_API_URL=http://localhost:3001
VITE_PEXELS_API_KEY=ваш_ключ_pexels
VITE_USE_LOCAL_LLM=false
VITE_GROG_CLOUD_API_KEY=ваш_ключ_groq
VITE_GROG_MODEL=llama-3.1-8b-instant

PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=пароль
DB_NAME=gift_finder
JWT_SECRET=секретний_ключ
```
4. Виконати скрипт ````src/database/init.sql```` у MySQL Workbench на вашому сервері Mysql

---

## ▶️ Запуск

Запустити одночасно фронтенд і бекенд:

````
npm run dev:full
````

Фронтенд буде доступний на: http://localhost:5173

---

## 📝 Як користуватись

### 👤 Користувач

- **Реєстрація** — ````/register````
- **Вхід** — ````/login````
- **Головна** — ````/````
- **Підбір подарунків** — ````/gift-finder````
  - Заповнити форму: вік, стать, інтереси, професія, бюджет, привід
  - Обрати кількість AI-подарунків (опціонально)
  - Отримати: 8 з бази + AI-генерація (за потреби)
- **Профіль** — ````/profile````

### 🔐 Адмін

- ````GET /api/refresh-images?force=true|false````
  - `force=false` — оновлює лише порожні зображення
  - `force=true` — оновлює всі записи

---

## 📁 Архітектура

- `src/api/server.js` — основний сервер, API, фонові задачі
- `src/database/init.sql` — початкова структура бази
- `src/services/`
  - `pexelsService.js` — зображення, переклади
  - `aiService.js` — взаємодія з Groq
  - `giftSelectionService.js` — AI-підбір подарунків
- `src/pages/` — сторінки фронтенду
- `src/components/` — компоненти (Header, Protected Route)
- `src/store/` — Redux slices + persist
- `src/styles/` — стилі компонентів
