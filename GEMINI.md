# GEMINI.md

## Project Overview

**Point Cloud Annotator** is a full-stack web application designed to display 3D point clouds and allow users to annotate them.

*   **Core Functionality:** Users can view a 3D point cloud (via Potree), create annotations by clicking on points, and save text notes. Annotations are persistent.
*   **Architecture:**
    *   **Frontend:** Vanilla JavaScript application using the Potree Viewer and Three.js.
    *   **Backend:** Node.js application.
        *   *Local Development:* Express.js server with `lowdb` (JSON file) for storage.
        *   *Production:* AWS Lambda functions behind API Gateway, using DynamoDB for storage.
    *   **Infrastructure:** Managed via AWS Serverless Application Model (SAM).

## Getting Started

### Prerequisites
*   Node.js 18+
*   `pnpm` (Project uses `pnpm` workspaces/commands)

### Key Commands

Run these commands from the **root** directory:

| Command | Description |
| :--- | :--- |
| `pnpm run install:all` | Installs dependencies for root, frontend, and backend. |
| `pnpm start` | Starts **both** the frontend and local backend servers concurrently. |
| `pnpm run start:frontend` | Starts only the frontend server (default: `http://localhost:3000`). |
| `pnpm run start:backend` | Starts only the local backend server (default: `http://localhost:3001`). |
| `pnpm run deploy` | Deploys the backend to AWS using SAM (requires AWS CLI/SAM CLI). |

## Project Structure

```text
/
├── frontend/               # Frontend Application
│   ├── app.js              # Main application logic (Potree init, interactions)
│   ├── api.js              # API client service
│   ├── config.js           # Configuration (toggle between Local/AWS)
│   ├── index.html          # Entry point
│   └── styles.css          # Styling
├── backend/                # Backend Application
│   ├── local-server.js     # Express server for local development
│   ├── db.json             # Local JSON database (created on run)
│   ├── template.yaml       # AWS SAM infrastructure definition
│   └── src/                # Lambda function source code
│       └── index.js        # Main Lambda handler
├── package.json            # Root configuration & scripts
└── README.md               # Detailed documentation
```

## Development Conventions

*   **State Management:** The frontend is a vanilla JS app; state is managed within `app.js` and synced via `api.js`.
*   **Local vs. Production:**
    *   The project is designed to be agnostic between local and cloud environments.
    *   **Frontend:** `frontend/config.js` controls the target API via `USE_LOCAL_API`.
    *   **Backend:** `local-server.js` mimics the AWS Lambda/API Gateway behavior. When modifying the API, ensure both `local-server.js` and `src/index.js` (Lambda) are updated to maintain parity.
*   **Styling:** Pure CSS in `styles.css`.
*   **Database:**
    *   Local: `backend/db.json` (auto-generated).
    *   Prod: AWS DynamoDB (defined in `template.yaml`).

## Important Files

*   `frontend/config.js`: Central configuration. Check this first if the frontend can't connect.
*   `backend/template.yaml`: Defines the AWS resources (DynamoDB table, Lambda, API Gateway).
*   `backend/local-server.js`: Implements the local REST API logic.
