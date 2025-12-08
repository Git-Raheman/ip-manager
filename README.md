# IP Manager Project Collection

Welcome to the **IP Manager** repository. This project houses multiple variations of a robust IP address management and system monitoring application, tailored for different use cases and deployment environments.

## 📂 Project Structure

This repository is organized into three distinct versions of the application:

### 1. [Single User Based](./single_user_based)
> *Best for personal use or standalone deployments.*
*   **Path**: `/single_user_based`
*   **Features**: Secure single-user login, IP record management, system monitoring, status checks, and data backup/restore capabilities.
*   **Documentation**: See [single_user_based/README.md](./single_user_based/README.md)

### 2. [Multi-User Based](./multi_user_bassed)
> *Best for teams and organizations.*
*   **Path**: `/multi_user_bassed`
*   **Features**: Full multi-user support with role-based access, user management, comprehensive logging, and all core IP management features.
*   **Documentation**: See [multi_user_bassed/README.md](./multi_user_bassed/README.md)

### 3. [Multi-User (No Logs)](./multi_user_without_logs)
> *Best for lightweight multi-user deployments.*
*   **Path**: `/multi_user_without_logs`
*   **Features**: Similar to the multi-user version but optimized by removing the logging overhead. Ideal for environments where resource efficiency is paramount or logging is handled externally.

## 🚀 General Getting Started

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd ip-manager
    ```

2.  **Choose your version**:
    Navigate to the directory that best fits your needs:
    ```bash
    # For single user
    cd single_user_based
    
    # For multi user
    cd multi_user_bassed
    ```

3.  **Run with Docker**:
    Each version is Dockerized. Typically, you can start them using:
    ```bash
    docker-compose up -d --build
    ```
    *Refer to the specific README in each subdirectory for detailed configuration and deployment instructions.*

## 📄 License

This project is open-source and available under the [MIT License](./LICENSE).
