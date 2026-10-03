# SODA Frontend

Фронтенд-застосунок для польової команди: фотозвіти, продажі, маршрути,
повідомлення, планові показники.

## Запуск

```bash
npm install
npm run dev
```

## Хто за що відповідає

- `src/main.tsx`: точка входу, підключає Router і React Query провайдери.
- `src/App.tsx`: головний координатор флоу (авторизація, доступи за ролями,
  перемикання екранів).
- `src/api/config.ts`: базовий URL API та ключі сесії в localStorage.
- `src/api/client.ts`: універсальний HTTP-клієнт (`GET`, `POST JSON`,
  `POST FormData`) + обробка помилок.
- `src/api/auth.ts`: логін, відновлення/очищення сесії, нормалізація ролей із
  бекенду.
- `src/api/fetchSales.ts`: адаптер продажів (серіалізація фільтрів, нормалізація
  полів, агрегаційні ендпоінти).
- `src/hooks/*`: повторно-використовувана логіка стану і поведінки (фільтри,
  повідомлення, геолокація).
- `src/config/*`: правила доступу, ролі, feature-флаги.
- `src/components/HomePage/*`: головне меню і вхід у розділи.
- `src/components/StoreSelector/*`: вибір відділу/ТП/точки перед створенням
  звіту.
- `src/components/SalesPage/*`: екран аналітики продажів (фільтри, таблиці,
  деталізація).
- `src/components/InfoBoardPage/*`: дошка повідомлень.
- `src/components/PlanTargetsPage/*`: планові показники.
- `src/components/StoreCheckPage/*`, `src/components/StoreCheckReviewPage/*`:
  створення і перевірка StoreCheck.
- `src/components/PhotoReport/*`, `src/components/ShowcasePromotion/*`,
  `src/components/PhotoUpload/*`: створення фотозвітів і завантаження фото.
- `src/utils/*`: утиліти, наприклад експорт у Excel.

## Структура даних і доступів (коротко)

- Авторизація: токен зберігається в localStorage і автоматично додається в
  API-запити.
- Ролі: бекенд-ролі мапляться у фронтові (`admin`, `supervisor`, `agent`).
- Доступ до розділів: перевіряється в `App.tsx` через `canAccessSection` і
  `backendFeatures`.
- Дані продажів: React Query кешує і перевикористовує відповіді; `SalesPage`
  обирає режим агрегації (бренд/ТТ/відділ/агент).

## Нотатка для розробки

У ключових файлах уже додані короткі коментарі по відповідальності модулів, щоб
швидко входити в кодову базу без зайвого читання.
