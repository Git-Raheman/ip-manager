# IP Manager

A production-ready 4-tier Dockerized IP Management web application.

## Architecture

1.  **Proxy (Nginx)**: Reverse proxy routing traffic to frontend and backend.
2.  **Frontend**: React SPA served by Nginx (built with esbuild).
3.  **Backend**: Node.js/Express API.
4.  **Database**: PostgreSQL.

## Prerequisites

- Docker and Docker Compose

## Running Locally

1.  Navigate to the project directory:
    ```bash
    cd ip-manager
    ```

2.  Start the application:
    ```bash
    docker-compose up --build
    ```

3.  Access the application at [http://localhost](http://localhost).

## Kubernetes Migration

Manifests are located in the `k8s/` directory.

1.  Apply the manifests:
    ```bash
    kubectl apply -f k8s/
    ```

## Features

- **User Management**: Role-based access control (Admin/Readonly).
- **IP Management**: Track IP, Hostname, Ports, Status, and Notes.
- **Ping Tool**: Real-time ping from the backend.
- **Security**: JWT Auth, Rate Limiting, Non-root containers.

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

## API Endpoints

- `POST /api/login`: Authenticate
- `GET /api/ips`: List all IPs (Auth required)
- `POST /api/ips`: Add a new IP (Admin only)
- `PUT /api/ips/:id`: Update an IP (Admin only)
- `DELETE /api/ips/:id`: Delete an IP (Admin only)
- `POST /api/ping`: Ping an IP (Auth required)
- `GET /api/users`: List users (Admin only)
- `POST /api/users`: Create user (Admin only)
- `DELETE /api/users/:id`: Delete user (Admin only)

## Security Features

- Non-root containers (User `appuser` or `nginx` unprivileged).
- Rate limiting on API.
- Input validation for Ping.
- Helmet for security headers.
