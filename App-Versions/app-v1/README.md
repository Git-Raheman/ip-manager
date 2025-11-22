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

## API Endpoints

- `GET /api/ips`: List all IPs
- `POST /api/ips`: Add a new IP
- `PUT /api/ips/:id`: Update an IP
- `DELETE /api/ips/:id`: Delete an IP
- `POST /api/ping`: Ping an IP

## Security Features

- Non-root containers (User `appuser` or `nginx` unprivileged).
- Rate limiting on API.
- Input validation for Ping.
- Helmet for security headers.
