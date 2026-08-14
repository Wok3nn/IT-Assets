# 🖥️ IT Asset Tracker

<p align="center">
  <img src="./IT-Assets%20Logo/asset-tracker-logo-dark-transparent%20256x256.png" width="180" alt="IT Asset Tracker Logo" />
</p>

<p align="center">
  A modern, self-hosted IT asset management system built for internal teams.
</p>

---

## ✨ What is this?

**IT Asset Tracker** helps you manage:

- Devices (laptops, desktops, equipment)
- Who has what assigned
- Locations and departments
- Asset status (In Use, Available, Retired)
- Labels with QR / Barcode
- Imports / exports

All running **locally with Docker** — no cloud dependency required.

---

## 🔥 Core Features

- 🧾 **Asset Management**
  - Assign assets to users
  - Track status, category, location
- 👤 **User Management**
  - View assigned assets per user
- ⚡ **Quick Check In / Check Out**
  - Fast modal workflow (no page switching)
- 🏷 **Label Printing**
  - QR codes + barcodes
- 📥 **CSV Import / Export**
- 🎨 **Clean UI + Dark Mode**
- 🔐 **Optional Microsoft Entra Login**
- 🐳 **Docker-first deployment**

---

## 📸 Screenshots

> <img width="2552" height="1273" alt="image" src="https://github.com/user-attachments/assets/ed21d7a7-4500-44fc-8f78-e56897c687fb" />

> <img width="2558" height="1276" alt="image" src="https://github.com/user-attachments/assets/f2e0a198-4352-4c3f-bc60-0ed04872128b" />

> <img width="2557" height="1276" alt="image" src="https://github.com/user-attachments/assets/224ef192-a702-4ae1-98c3-2f3557077a14" />

> <img width="2557" height="1271" alt="image" src="https://github.com/user-attachments/assets/5997984a-c11b-4fe8-b014-3b50c97bf840" />

> <img width="2558" height="1279" alt="image" src="https://github.com/user-attachments/assets/7c4b85ef-c655-479f-8ec5-71ece29ad953" />

---

## ⚡ Quick Start (2–3 minutes)

### 1. Clone the repo

- mkdir -p /opt/docker/apps
- cd /opt/docker/apps
- git clone <repo-url> It-Assets-Tracker

### 2. Copy the Docker compose

- mkdir -p /opt/docker/compose
- cp It-Assets-Tracker/docker/docker-compose.example.yml /opt/docker/compose/IT-Assets-Tracker.yml

### 3. Edit config (VERY IMPORTANT)

- Open:
  - nano /opt/docker/compose/IT-Assets-Tracker.yml

- Change:
  - APP_URL: http://YOUR-IP:4050
  - SESSION_SECRET: change-me
  - APP_SETTINGS_ENCRYPTION_KEY: generate a persistent 32-byte key
  - MARIADB_PASSWORD: change-me
  - MARIADB_ROOT_PASSWORD: change-me-root
  - Optional Exchange Email Service credentials are configured later in Settings -> Exchange Email Service

  Generate `APP_SETTINGS_ENCRYPTION_KEY` once and keep it stable across restarts/redeployments:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

  Changing this key after saving encrypted settings, such as the Exchange Email Service Client Secret, will make those encrypted values unreadable until they are re-entered.

### 4. Start the app
  
- mkdir -p /opt/docker/data/it-assets-tracker/app
- mkdir -p /opt/docker/data/it-assets-tracker/mariadb

- docker compose -f /opt/docker/compose/IT-Assets-Tracker.yml up -d --build

### 5. Open the App

- http://YOUR-IP:4050
- Run the setup wizard → create your admin account → done ✅

### 🔄️ Updating

- cd /opt/docker/apps/It-Assets-Tracker
- git pull

- cd /opt/docker/compose
- docker compose -f IT-Assets-Tracker.yml up -d --build

### 💾 Backups (IMPORTANT)

- Backup this folder:
  - /opt/docker/data/it-assets-tracker

### 🌐 Reverse Proxy (Optional)

- Works great with:
  - Nginx Proxy Manager
  - Traefik
  - Cloudflare Tunnel

- Set:
  - APP_URL=https://your-domain.com

```bash
