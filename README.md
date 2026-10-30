# Life OS

A personal dashboard for your whole life. No install and no account, and it works offline.

**To open it:** double-click `index.html`, which opens it in your browser. Bookmark it.
Or put it online for free with GitHub Pages (see below) and share the link with friends.

## Accounts
There are two modes:
- **Device accounts** (the default): no setup. Accounts and data are saved in each person's browser on that device.
- **Cloud sync** (after the one-time Firebase setup below): sign in with email and password or Google on any phone or computer, and your data stays in sync everywhere. Passwords can be reset by email.

### Device accounts
- When the app opens, you create an account or log in. Each account has its own separate data: tasks, money, workouts and everything else.
- Several people can use the same computer. A "Who's using Life OS?" screen lets each person pick their account.
- Passwords are salted and hashed with PBKDF2 and are never stored as plain text. After 5 wrong tries, logging in to that account is paused for a while.
- "Keep me signed in" keeps you logged in for 30 days. Without it, you're logged out when the browser closes.
- Manage your account in **Settings → Account**: change your name, avatar color or password, log out, or delete the account.
- Device accounts don't sync between devices, and their passwords can't be reset by email. Turn on cloud sync for that, or use **Settings → Data & backup → Export / Import** to move data by hand.

## Turn on cloud sync (free, about 10 minutes, one time)
The app uses **Firebase**, a free Google service, to store each person's data in their own private space. The free plan is far more than you and your friends will need.

**1. Create the project**
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Create a project**. Name it, for example, `life-os`. You can turn Google Analytics off. Then click **Create project**.

**2. Turn on sign-in**
1. In the left menu, open **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, enable **Email/Password** and save.
3. Optional: also enable **Google**. Pick a support email and save. This adds the "Continue with Google" button.
4. Go to **Settings → Authorized domains** and click **Add domain**. Enter your GitHub Pages address without `https://` or the folder, for example `bernopro.github.io`.

**3. Create the database**
1. In the left menu, open **Build → Firestore Database** and click **Create database**.
2. Pick a location close to you, for example `eur3` for Europe. Choose **Start in production mode**.
3. Open the **Rules** tab. Replace everything there with the contents of the [`firestore.rules`](firestore.rules) file in this folder, then click **Publish**. These rules let each person read and write only their own data.

**4. Connect the app**
1. Click the ⚙️ gear next to **Project Overview** and open **Project settings**.
2. Under **Your apps**, click the web icon **`</>`**. Give it a nickname such as `life-os-web` and register it. You don't need Firebase Hosting.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy it.
4. Open [`js/firebase-config.js`](js/firebase-config.js) and replace `null` with those values:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "life-os-xxxx.firebaseapp.com",
     projectId: "life-os-xxxx",
     storageBucket: "life-os-xxxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Upload the changed file to GitHub. The sign-in screen will now show **Sync on**.

These config values are meant to be public. Your data is protected by your login and the database rules from step 3, not by keeping this file secret.

**How syncing behaves**
- Every change is saved on the device straight away and sent to the cloud about a second later. Other signed-in devices update automatically.
- It works offline. Changes wait on the device and sync when you're back online. The cloud icon in the top bar shows the status: green when synced, orange when offline.
- If two devices changed things while offline, the app asks which version to keep.
- The first time you sign in with cloud sync, the app offers to bring over data that's already on that device.
- **Settings → Account** has Sync now, Reload from cloud, change password, email reset link, and delete account.

## Share it with friends (GitHub Pages, free)
1. Create a free account at https://github.com and click **New repository**. Name it, for example, `life-os`, set it to **Public**, then click **Create repository**.
2. Upload the files using one of these options:
   - **In the browser:** on the new repository page click **uploading an existing file**. Drag in everything from this folder: `index.html`, `README.md`, `firestore.rules`, `.nojekyll`, and the `css` and `js` folders. Then click **Commit changes**.
   - **With git:** this folder is already a git repository with everything committed. Run:
     ```
     git remote add origin https://github.com/bernopro/life-os.git
     git push -u origin main
     ```
3. In the repository, go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick **main** and **/ (root)**, then click **Save**.
4. Wait about a minute. Your site will be at `https://bernopro.github.io/life-os/`. Send that link to your friends.

To update the site later, upload the changed files again (or run `git push`). Everyone gets the new version, and their accounts and data stay as they are.

## What's inside
- **Dashboard**: widgets you can move, resize and hide (click **Customize**).
- **Calendar**: month, week, day and agenda views. Repeating events. You can also show tasks, workouts, bills and exams on it.
- **Tasks**: lists, priorities, subtasks, repeating tasks. Quick add understands phrases like `Pay rent friday !high #personal`.
- **Habits**: yes/no or count habits. Schedule them daily, on chosen days, or a number of times per week. Includes streaks and heatmaps.
- **Gym & Fitness**: 18 training types: strength, calisthenics, CrossFit, HIIT, running, cycling, swimming, walking/hiking, cardio machines, boxing/martial arts, yoga, pilates, stretching, team sports, tennis, climbing, dance and other.
  - Log exercises four ways: weights, bodyweight reps, timed rounds, or cardio (minutes + distance).
  - Quick log for classes and matches. Optional intensity (1–10) and calories.
  - A "By type" page shows your training mix. Also includes a rest timer, routines, automatic PRs, 1RM charts and body weight.
- **Nutrition & Sleep**: calories and macros, one-tap foods you log often, water, and sleep with trends.
- **Money**: multi-currency: Armenian dram ֏, US dollar, euro, ruble, pound, lari, or any currency you add.
  - Each transaction keeps its own currency.
  - Switch which currency totals are shown in with one click: ֏ / $ / €.
  - Exchange rates can be edited by hand or updated online. Includes a quick converter, budgets, recurring bills (optional auto-pay) and CSV export.
- **Study**: any kind of subject, such as school/university, languages, programming, maths and science, music, art, business, exam prep, online courses, reading and practical skills.
  - Log sessions by type of study: reading, lecture, video, practice, homework, revision, flashcards, writing, listening, speaking, project, mock exams, tutoring, research and instrument practice.
  - Weekly goals, topic checklists, study streak.
  - Exams and deadlines with countdowns, scores and a results trend.
  - The Focus Timer can log study time to a subject automatically.
- **Journal**: mood, energy, tags, gratitude, writing prompts and a mood calendar.
- **Notes**: pin, color and tag notes. Supports simple markdown and clickable checklists.
- **Goals**: track a number or a list of milestones, with a deadline and an on-track/behind indicator.
- **Focus Timer**: Pomodoro with auto-start options. The timer keeps running while you use other pages.

## Make it yours (Settings)
- 7 themes, any accent color, 6 fonts, text size, density, corner style and sidebar style.
- Turn modules on or off, and reorder the menu.
- Daily targets: calories, macros, water, sleep, workouts, study time and goal weight.
- Units, currencies, start of the week, 12h or 24h clock.

## Keyboard
`Ctrl+K` search and commands · `N` task · `E` event · `W` workout · `S` study session · `J` journal · `T` light/dark · `F` focus · `G` then `1–9` jump to a page · `?` all shortcuts

## Your data
Your data is saved in this browser on this computer. Nothing is sent anywhere, except when you click "Update rates online", which fetches exchange rates.
Use **Settings → Data & backup → Export** to keep a backup or move your data to another device.
