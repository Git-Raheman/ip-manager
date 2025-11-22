# 🌐 IP Manager

A powerful, easy-to-use tool to manage IP addresses, track servers, and organize your network infrastructure.

**Built with ❤️ by Shaikh Abdul Raheman & Antigravity AI**

---

## 🚀 Features

- **📊 Dashboard**: View all your IPs in one place.
- **📑 Tabs System**: Organize IPs into tabs (e.g., "Office", "Servers", "Printers").
- **🔍 Search & Filter**: Instantly find any IP by address, hostname, or note.
- **⚡ Real-time Ping**: Check if a server is online directly from the dashboard.
- **👥 User Management**:
  - **Admin**: Can add, edit, and delete IPs.
  - **Read-only**: Can view the list but cannot make changes.
- **📝 History Tracking**: See who created or last updated an IP.
- **🔒 Secure**: Built with secure login and session protection.

---

## 🛠️ How to Run

You don't need to install Node.js or PostgreSQL manually. Everything runs in **Docker**.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your computer.

### Steps to Start
1. **Open your terminal** (Command Prompt or PowerShell).
2. **Go to the project folder**:
   ```bash
   cd ip-manager
   ```
3. **Start the app**:
   ```bash
   docker-compose up --build -d
   ```
4. **Open your browser** and go to:
   👉 **[http://localhost](http://localhost)**

---

## 🔑 Login Credentials

Use these details to log in for the first time:

| Role | Username | Password |
|------|----------|----------|
| **Admin** | `admin` | `admin123` |

> *Note: You can create more users inside the app.*

---

## 📂 Project Structure

- **frontend/**: The website you see (React).
- **backend/**: The logic behind the scenes (Node.js).
- **proxy/**: Handles traffic routing (Nginx).
- **k8s/**: Files for Kubernetes deployment (Advanced).

---

*Enjoy managing your network!* 🚀
