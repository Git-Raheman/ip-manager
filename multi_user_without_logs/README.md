# IP Manager (Lightweight Multi-User)

> ⚠️ **NOTICE: THIS APPLICATION IS CURRENTLY IN BETA AND IS NOT STABLE.**
> 
> 🛑 **CRITICAL WARNING:** DATA LOSS IS POSSIBLE. **YOU MUST BACKUP YOUR DOCKER VOLUMES REGULARLY.**

## Overview

The **Lightweight Multi-User** edition of IP Manager is optimized for performance and resource efficiency. It retains the powerful multi-user authentication and IP management features of the main branch but removes the activity logging module.

**Best for:**
*   Deployments on low-resource hardware.
*   Teams that do not require audit trails of modifications.
*   Environments where database size needs to be minimized.

## ✨ Key Features

*   **Multi-User Support**: Full login system with multiple users.
*   **Optimized Performance**: Reduced database writes and storage usage by removing logs.
*   **IP Management**: Create, Read, Update, and Delete IP records efficiently.
*   **System Monitoring**: Track uptime and network status.
*   **Backup & Restore**: Database backup functionality included.

## 🚀 Getting Started

### Prerequisites
*   Docker & Docker Compose

### Installation

1.  Navigate to the directory:
    ```bash
    cd multi_user_without_logs
    ```
2.  Start the application:
    ```bash
    docker-compose up -d --build
    ```
3.  Access the UI at `http://localhost:8080`.

## ⚙️ Configuration

Check `docker-compose.yml` for environment variables. Default database credentials:
*   User: `user`
*   Password: `password`

## 🛡️ Backup Guide

To prevent data loss, regularly backup the `pgdata` volume. Example command:

```bash
docker run --rm -v multi_user_without_logs_pgdata:/volume -v $(pwd):/backup alpine tar -czf /backup/db_backup.tar.gz -C /volume ./
```
