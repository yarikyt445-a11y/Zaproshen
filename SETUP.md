# Запрошення ✦ — Інструкція з налаштування

## 1. Firebase (Realtime Database & Auth)

Цей проект працює повністю на безкоштовному тарифі Firebase і не вимагає прив'язки банківської картки.
Усі дані (навіть аватарки) зберігаються в Realtime Database.

### Крок 1: Увімкнення Authentication
1. Перейдіть в [Firebase Console](https://console.firebase.google.com)
2. Відкрийте ваш проект `zaproshennya-a1ea7`
3. В лівому меню натисніть **Build → Authentication**
4. Натисніть **Get Started**
5. Перейдіть на вкладку **Sign-in method**
6. Увімкніть **Email/Password**
7. Натисніть **Save**

### Крок 2: Правила безпеки Realtime Database
В Firebase Console → Realtime Database → Rules, вставте цей код та натисніть Publish:

```json
{
  "rules": {
    "users": {
      ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'founder' || root.child('users').child(auth.uid).child('role').val() === 'tech-admin' || root.child('users').child(auth.uid).child('role').val() === 'moderator')",
      ".indexOn": ["createdAt"],
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'founder' || root.child('users').child(auth.uid).child('role').val() === 'tech-admin' || root.child('users').child(auth.uid).child('role').val() === 'moderator'"
      }
    },
    "logins": {
      ".read": true,
      "$login": {
        ".write": "auth != null"
      }
    },
    "ids": {
      ".read": true,
      "$id": {
        ".write": "auth != null"
      }
    },
    "invites": {
      ".read": true,
      "$invId": {
        ".write": "auth != null"
      }
    },
    "statuses": {
      ".read": true,
      "$invId": {
        ".write": true
      }
    },
    "reschedule": {
      ".read": true,
      "$invId": {
        ".write": true
      }
    },
    "user-invites": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'founder' || root.child('users').child(auth.uid).child('role').val() === 'tech-admin'",
        ".write": "auth != null"
      }
    },
    "friends": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "friend-requests": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "notifications": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "auth != null",
        ".indexOn": ["createdAt", "read"]
      }
    },
    "group-invites": {
      ".read": true,
      "$invId": {
        ".write": "auth != null"
      }
    },
    "reports": {
      ".read": "root.child('users').child(auth.uid).child('role').val() === 'founder' || root.child('users').child(auth.uid).child('role').val() === 'tech-admin' || root.child('users').child(auth.uid).child('role').val() === 'moderator'",
      ".write": "auth != null",
      ".indexOn": ["createdAt", "status"]
    }
  }
}
```

## 2. Деплой на GitHub Pages

### Крок 1: Створення репозиторію
```bash
cd c:\Zap
git init
git add .
git commit -m "Initial commit: Запрошення platform"
```

### Крок 2: Завантаження на GitHub
1. Створіть новий репозиторій на [github.com](https://github.com/new)
2. Виконайте:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Крок 3: Увімкнення GitHub Pages
1. Перейдіть в Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main**, папка: **/ (root)**
4. Натисніть **Save**
5. Через 1-2 хвилини сайт буде доступний за адресою:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## 3. Структура проекту

```
Zap/
├── index.html              ← SPA entry point
├── css/
│   ├── variables.css       ← Design tokens, animations
│   ├── components.css      ← Buttons, cards, forms, modals
│   ├── layout.css          ← Topbar, sidebar, grid, responsive
│   ├── pages.css           ← Auth, profile, friends pages
│   └── dashboard.css       ← Admin dashboard styles
└── js/
    ├── firebase-config.js  ← Firebase initialization
    ├── crypto.js            ← AES-GCM encryption (Web Crypto API)
    ├── utils.js             ← Common helpers
    ├── router.js            ← Hash-based SPA router
    ├── notifications.js     ← Push + in-app notifications
    ├── auth.js              ← Registration, login, sessions
    ├── db.js                ← All CRUD operations
    ├── app.js               ← Main orchestrator
    └── pages/
        ├── login.js         ← Login / Register page
        ├── home.js          ← My invitations list
        ├── create.js        ← Create invitation (personal + group)
        ├── invite.js        ← Recipient view
        ├── profile.js       ← Profile settings
        ├── user-profile.js  ← View other user's profile
        ├── friends.js       ← Friends & search
        └── dashboard.js     ← Admin panel
```
