# 🌐 IP MANAGER

[![GitHub Repo](https://img.shields.io/badge/GitHub-Git--Raheman%2Fip--manager-blue?logo=github)](https://github.com/Git-Raheman/ip-manager)
[![Docker Hub App](https://img.shields.io/badge/Docker%20Hub-ip__manager__v2__app-blue?logo=docker)](https://hub.docker.com/r/dockeraheman/ip_manager_v2_app)
[![Docker Hub DB](https://img.shields.io/badge/Docker%20Hub-ip__manager__v2__db-blue?logo=docker)](https://hub.docker.com/r/dockeraheman/ip_manager_v2_db)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Git-Raheman/ip-manager/pulls)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, full-stack IP Address Management system featuring subnet visualizers, live network ping discovery, Excel import/export, role-based access control, and Active Directory / LDAP support.

🔗 **Project Links:**
* 🐙 **GitHub Repository:** [https://github.com/Git-Raheman/ip-manager](https://github.com/Git-Raheman/ip-manager)
* 🐳 **Docker Hub App Image:** [`dockeraheman/ip_manager_v2_app`](https://hub.docker.com/r/dockeraheman/ip_manager_v2_app)
* 🗄️ **Docker Hub Database Image:** [`dockeraheman/ip_manager_v2_db`](https://hub.docker.com/r/dockeraheman/ip_manager_v2_db)
* 👤 **Author & Maintainer:** [@Git-Raheman](https://github.com/Git-Raheman)

---

## 📸 Application Screenshots

| 📊 Dashboard Overview | 🌐 Subnet Explorer & Allocation |
| :---: | :---: |
| ![Dashboard Overview](screenshots/Dashbord.png) | ![Subnet View](screenshots/subnet_view.png) |

| 🔐 Login & Authentication | 👥 User Management & Roles |
| :---: | :---: |
| ![Login Page](screenshots/Login_page.png) | ![User Management](screenshots/users.png) |

| 📋 Audit Logs & Activity Tracking | 🏢 LDAP / Active Directory Integration |
| :---: | :---: |
| ![Audit Logs](screenshots/audit.png) | ![LDAP Integration](screenshots/ldap.png) |

| 🏷️ Device Types & Custom Metadata | 💾 Database Backup & Restore |
| :---: | :---: |
| ![Device Types](screenshots/device%20types.png) | ![Backup & Restore](screenshots/backup%26restore.png) |

---

## 🔑 Default Login Credentials

* **URL:** [http://localhost:3000](http://localhost:3000)
* **Username:** `admin`
* **Password:** `admin`

---

## 🗄️ Database Setup: Do I Need to Setup a Database?

**Short answer: No, setup is optional! You have 3 simple choices:**

| Option | Setup Effort | How It Works |
| :--- | :---: | :--- |
| **Option 1: Quick Deploy (Docker Hub)** | ⚡️ **Instant (Single File)** | Use [`deploy/docker-compose.yml`](./deploy/docker-compose.yml). Zero configuration, no `.env` needed! Pulls pre-built images from Docker Hub (`dockeraheman/ip_manager_v2_app` & `dockeraheman/ip_manager_v2_db`). |
| **Option 2: Built-in File DB (Default)** | ⭐️ **Zero Setup** | Just run `npm run dev`. If no PostgreSQL is found, the system automatically creates and uses a persistent JSON file at [`data/ipam-database.json`](./data/ipam-database.json). Everything works immediately. |
| **Option 3: Build from Source (Docker)** | 🚀 **1 Command** | Run `docker compose up -d` in the root directory. Builds from local source code and spins up PostgreSQL 16. |
| **Option 4: Manual PostgreSQL (Local)** | 🛠️ **Custom** | Connect your own PostgreSQL instance on Windows or Ubuntu. |

---

## 📦 Prerequisites (What You Need to Install)

| Tool / Package | 🪟 Windows (Laptop / PC) | 🐧 Ubuntu / Linux |
| :--- | :--- | :--- |
| **Docker** *(Recommended)* | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Docker Engine & Docker Compose plugin |
| **Node.js** *(for local non-docker dev)* | v20.x or higher ([nodejs.org](https://nodejs.org/)) | `sudo apt install -y nodejs npm` (v20+) |
| **Git** | [git-scm.com](https://git-scm.com/) or `winget install Git.Git` | `sudo apt install -y git` |
| **PostgreSQL** *(optional)* | Bundled in Docker (or installer from postgresql.org) | Bundled in Docker (or `sudo apt install postgresql`) |

---

## 🚀 Quick Setup & Run

### Method 1: Instant Quick Deploy (Pre-Built Docker Hub Images) ⚡

The fastest way to deploy without building any code. The [`deploy/`](./deploy) directory contains a single self-contained file:
* [`deploy/docker-compose.yml`](./deploy/docker-compose.yml) — pre-configured with default port (`3000`), credentials, and Docker Hub images ([`dockeraheman/ip_manager_v2_app`](https://hub.docker.com/r/dockeraheman/ip_manager_v2_app) & [`dockeraheman/ip_manager_v2_db`](https://hub.docker.com/r/dockeraheman/ip_manager_v2_db)). 

#### Run in 2 commands:
```bash
# 1. Navigate to the deploy folder:
cd deploy

# 2. Start the pre-built stack:
docker compose up -d
```

👉 Open your browser at: **`http://localhost:3000`**

To view logs or stop:
```bash
# View live logs:
docker compose logs -f

# Stop containers:
docker compose down
```

---

### Method 2: Build from Source with Docker

Builds containers directly from the local project files:

#### 🪟 Windows (PowerShell) / 🐧 Ubuntu (Terminal)
```bash
# 1. Build and start the stack:
docker compose up -d --build

# 2. Check container health:
docker compose ps

# 3. View logs:
docker compose logs -f
```
👉 Open your browser at: **`http://localhost:3000`**

To stop:
```bash
docker compose down
```

---

### Method 3: Local Development (Without Docker)

Run directly on your laptop using Node.js:

#### 🪟 Windows Setup (PowerShell)
```powershell
# 1. Install project packages:
npm install

# 2. Copy environment configuration:
Copy-Item .env.example .env

# 3. Start development server (uses built-in file database automatically):
npm run dev
```

#### 🐧 Ubuntu Setup (Terminal)
```bash
# 1. Install packages and ping utilities:
sudo apt update && sudo apt install -y iputils-ping
npm install

# 2. Copy environment configuration:
cp .env.example .env

# 3. Start development server (uses built-in file database automatically):
npm run dev
```
👉 Open your browser at: **`http://localhost:3000`**

---

### Method 4: Connecting to a Real Local PostgreSQL Database (Optional)

If you prefer using a real PostgreSQL database for local development instead of the built-in file DB:

#### 🪟 On Windows:
Run a quick PostgreSQL container via Docker:
```powershell
docker run -d --name ip-manager-postgres -p 5432:5432 -e POSTGRES_USER=ip_manager_admin -e POSTGRES_PASSWORD=ip_manager_secure_password_2026 -e POSTGRES_DB=ip_manager_db postgres:16-alpine
```

#### 🐧 On Ubuntu / Debian:
Install and configure native PostgreSQL:
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl enable --now postgresql

# Create the user and database
sudo -u postgres psql -c "CREATE USER ip_manager_admin WITH PASSWORD 'ip_manager_secure_password_2026';"
sudo -u postgres psql -c "CREATE DATABASE ip_manager_db OWNER ip_manager_admin;"
```

#### Point your `.env` to PostgreSQL:
In your `.env` file, set:
```bash
DATABASE_URL=postgresql://ip_manager_admin:ip_manager_secure_password_2026@localhost:5432/ip_manager_db
```
Restart your server with `npm run dev`. The app will automatically connect, build all necessary SQL tables, and sync your data!

---

## 🛠️ How to Make Changes & Updates

### 1. Where the Code Lives
* **Frontend UI (React 19 + Tailwind v4):** [`src/components/`](./src/components/)
  * Main IP Grid: [`src/components/SubnetDetailView.tsx`](./src/components/SubnetDetailView.tsx)
  * Navigation bar: [`src/components/Navbar.tsx`](./src/components/Navbar.tsx)
  * Global State: [`src/context/IPAMContext.tsx`](./src/context/IPAMContext.tsx)
* **Backend API & Server:** [`server.ts`](./server.ts)
  * Database logic & syncing: [`server/db.ts`](./server/db.ts)
  * Network Ping & Port Scans: [`server/networkUtils.ts`](./server/networkUtils.ts)
  * Active Directory / LDAP: [`server/ldapUtils.ts`](./server/ldapUtils.ts)

### 2. Testing & Building Your Changes
```bash
# Check for TypeScript errors:
npm run lint

# Build the production bundle:
npm run build

# Run the compiled production build:
npm start
```

### 3. Rebuilding Docker After Changes
If you modified code and are running with Docker:
```bash
docker compose up --build -d
```

---

## ⚙️ Environment Variables (`.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `APP_PORT` | `80` (Docker) / `3000` (Local) | Port where the server listens inside the container / local process |
| `HOST_PORT` | `3000` | Port exposed on your host machine to your browser (`http://localhost:3000`) |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string. If blank or unreachable, falls back to disk automatically. |
| `DATA_DIR` | `./data` | Local folder for persistent database files & exports |

---

## ❓ Troubleshooting

* **Do I have to install PostgreSQL?**
  No! If you don't install PostgreSQL, the app automatically stores everything safely in `data/ipam-database.json`.
* **Port 3000 is already in use?**
  Open `.env`, change `HOST_PORT=3001`, and rerun `docker compose up -d` (for local Node.js dev without Docker, change `APP_PORT=3001`).
* **Ping scanner not finding devices on Linux?**
  Run `sudo apt install -y iputils-ping`.
* **Reset all data to clean state?**
  Log in as `admin`, navigate to **Backup & Restore**, and click **Reset to Baseline**.

---

## 🤝 Open Source Contributors Welcome!

Hey there! 👋 I am a **System Administrator Intern**, not a professional software developer. I built **IP Manager with the help of AI** to solve real-world network and subnet tracking challenges that sysadmins face every day. 

Because I am still learning and building my developer skills, **your contributions, code reviews, feature suggestions, and advice are deeply appreciated!** Whether you are a seasoned software engineer, a DevOps enthusiast, a fellow sysadmin, or a student/intern:

> **✨ Everyone is warmly invited to contribute and build IP Manager together!**

### 💡 Ways You Can Help
* 🐛 **Report Bugs:** Find an issue? [Open a GitHub Issue](https://github.com/Git-Raheman/ip-manager/issues) with reproduction steps.
* 💡 **Suggest Features:** Have ideas for subnet calculators, SNMP polling, DHCP integration, or cloud sync? [Start a discussion or request a feature](https://github.com/Git-Raheman/ip-manager/issues/new).
* 💻 **Submit Code:** Help solve open issues, optimize network ping discovery, refine database schemas, or add new features.
* 🎨 **UI/UX & Themes:** Improve dashboards, data visualization, animations, or responsive design.
* 📖 **Documentation:** Clarify setup guides, add troubleshooting tips, or write tutorials.

---

### 🛠️ How to Contribute (Step-by-Step)

1. **Fork the Repository**  
   Click the **Fork** button at the top-right of [github.com/Git-Raheman/ip-manager](https://github.com/Git-Raheman/ip-manager).

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/<your-github-username>/ip-manager.git
   cd ip-manager
   ```

3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Install Dependencies & Make Changes**
   ```bash
   npm install
   npm run dev
   ```

5. **Commit Your Work**
   ```bash
   git add .
   git commit -m "feat: describe your improvements"
   ```

6. **Push & Open a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then visit [Git-Raheman/ip-manager/pulls](https://github.com/Git-Raheman/ip-manager/pulls) and click **"New Pull Request"**!

---

## 💖 Thanks for Your Support!

A huge **thank you** to everyone using, testing, and supporting **IP Manager**! Your interest, stars, and contributions motivate continuous improvements.

If you enjoy this project and would like to support its growth:
* ⭐ **Star this repository on [GitHub](https://github.com/Git-Raheman/ip-manager)** — it helps more developers and network admins discover it!
* 🐳 **Pull & Rate the images on [Docker Hub](https://hub.docker.com/u/dockeraheman)**
* 📢 **Share it with your team, colleagues, or community!**
* 💬 **Share feedback or feature requests in [GitHub Issues](https://github.com/Git-Raheman/ip-manager/issues)**

Every bit of support means the world. Thank you! 🙌

---

## 👤 Maintainer & Contact

* **GitHub:** [@Git-Raheman](https://github.com/Git-Raheman)
* **Docker Hub:** [@dockeraheman](https://hub.docker.com/u/dockeraheman)
* **Project Repository:** [https://github.com/Git-Raheman/ip-manager](https://github.com/Git-Raheman/ip-manager)

Distributed under the **MIT License**. Thank you to everyone contributing to the future of IP Manager!

