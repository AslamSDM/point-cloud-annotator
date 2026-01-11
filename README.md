# Point Cloud Annotator

A web application for viewing 3D point clouds and creating persistent annotations. Built with Potree for point cloud visualization and AWS Lambda + DynamoDB for serverless persistence.

![Point Cloud Annotator](https://img.shields.io/badge/Potree-1.8-blue) ![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange) ![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-blue)

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Technical Choices](#technical-choices)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [AWS Deployment](#aws-deployment)
- [API Reference](#api-reference)
- [Acceptance Criteria](#acceptance-criteria)
- [AI Tools Used](#ai-tools-used)

---

## Demo

> **Local Development**: Follow the [Getting Started](#getting-started) instructions below.

> **🚀 Live Demo**: [http://point-cloud-annotator-frontend-1768121629.s3-website-us-east-1.amazonaws.com](http://point-cloud-annotator-frontend-1768121629.s3-website-us-east-1.amazonaws.com)

> **API Endpoint**: `https://6f5pi0039b.execute-api.us-east-1.amazonaws.com/prod`

---

## Features

- **3D Point Cloud Visualization**: Load and display LAZ point clouds using Potree
- **Interactive Annotations**: Double-click on any point to create an annotation marker
- **Text Annotations**: Attach text descriptions (up to 256 bytes) to each annotation
- **CRUD Operations**: Create, read, update, and delete annotations
- **Persistence**: Annotations are saved to backend and reload on page refresh
- **Camera Navigation**: Click on any annotation to fly the camera to that location
- **Responsive UI**: Modern glass-morphism design with sidebar and toolbar

---

## Technical Choices

### Frontend: Vanilla JavaScript + Potree

**Why Vanilla JS instead of React/Vue?**

1. **Potree Compatibility**: Potree is a standalone WebGL library that manages its own rendering loop and DOM elements. It uses jQuery internally and doesn't integrate well with virtual DOM frameworks. Using React would require complex ref management and lifecycle synchronization with Potree's internal state.

2. **Simplicity**: The UI requirements (sidebar, modal, toolbar) are straightforward. A framework would add unnecessary bundle size and complexity for this use case.

3. **Performance**: Direct DOM manipulation avoids the overhead of virtual DOM diffing, which matters when coordinating with Potree's high-frequency render loop.

4. **No Build Step**: The application runs directly in the browser without transpilation, making development and debugging faster.

### Backend: AWS Lambda + API Gateway + DynamoDB (Tier 3)

**Why Serverless?**

1. **Zero Infrastructure Management**: No servers to provision, patch, or scale. AWS handles everything.

2. **Cost Efficiency**: Pay-per-request pricing means zero cost when idle. Perfect for demo/portfolio projects.

3. **Automatic Scaling**: Lambda scales automatically from zero to thousands of concurrent requests.

4. **DynamoDB Fit**: Annotations are simple key-value documents with UUID keys. DynamoDB's single-table design is perfect for this - no complex queries, just CRUD by ID.

**Why SAM for Infrastructure as Code?**

AWS SAM (Serverless Application Model) provides:
- Single YAML file defining all resources
- Built-in best practices for Lambda + API Gateway
- Local testing capabilities with `sam local`
- Simpler syntax than raw CloudFormation

### Local Development: Express + lowdb

For local development without AWS credentials, I included a local Express server that:
- Mirrors the Lambda API endpoints exactly
- Uses lowdb (file-based JSON database) for persistence
- Allows full testing of the frontend without cloud deployment

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Frontend                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Potree    │  │  Three.js   │  │   jQuery    │  │  Custom UI │ │
│  │   Viewer    │  │   (WebGL)   │  │  (Potree)   │  │    (CSS)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                              │                                       │
│                    REST API (fetch)                                  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │              AWS Cloud                       │
        │  ┌────────────────────────────────────────┐ │
        │  │         API Gateway (HTTP API)         │ │
        │  │         CORS enabled, /annotations     │ │
        │  └──────────────────┬─────────────────────┘ │
        │                     │                        │
        │  ┌──────────────────▼─────────────────────┐ │
        │  │          Lambda Function               │ │
        │  │     Node.js 18.x, handles CRUD         │ │
        │  └──────────────────┬─────────────────────┘ │
        │                     │                        │
        │  ┌──────────────────▼─────────────────────┐ │
        │  │            DynamoDB                    │ │
        │  │    On-demand, single table design      │ │
        │  └────────────────────────────────────────┘ │
        └─────────────────────────────────────────────┘
```

### Data Flow

1. **Page Load**: Frontend fetches `GET /annotations` → Lambda scans DynamoDB → returns all annotations
2. **Create**: User double-clicks point cloud → Frontend sends `POST /annotations` with 3D coordinates → Lambda creates record with UUID
3. **Update**: User edits text → Frontend sends `PUT /annotations/{id}` → Lambda updates record
4. **Delete**: User clicks delete → Frontend sends `DELETE /annotations/{id}` → Lambda removes record

---

## Project Structure

```
point-cloud-annotator/
├── frontend/
│   ├── index.html          # Main HTML with Potree container and UI
│   ├── styles.css          # Glass-morphism UI styling
│   ├── config.js           # API endpoints, feature flags
│   ├── api.js              # REST client for backend
│   ├── app.js              # Main application logic
│   ├── package.json        # Frontend dev dependencies
│   └── libs/
│       └── potree/         # Potree library (cloned from GitHub)
│
├── backend/
│   ├── src/
│   │   ├── index.js        # Lambda function handler
│   │   └── package.json    # Lambda dependencies (AWS SDK)
│   ├── template.yaml       # SAM template (Infrastructure as Code)
│   ├── samconfig.toml      # SAM deployment configuration
│   ├── local-server.js     # Express server for local development
│   ├── db.json             # Local JSON database
│   └── package.json        # Local dev dependencies
│
├── package.json            # Root scripts for running both servers
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js 18+**: [Download here](https://nodejs.org/)
- **pnpm**: Install with `npm install -g pnpm`
- **Git**: For cloning Potree

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd point-cloud-annotator
```

### Step 2: Install Dependencies

```bash
# Install root dependencies
pnpm install

# Install backend dependencies
pnpm install --dir backend

# Install frontend dependencies
pnpm install --dir frontend
```

### Step 3: Set Up Potree (One-time)

Potree must be cloned and built locally (it's too large for git and CDN links are unreliable):

```bash
# Clone Potree into frontend/libs
git clone --depth 1 https://github.com/potree/potree.git frontend/libs/potree

# Install Potree dependencies
pnpm install --dir frontend/libs/potree

# Build Potree
cd frontend/libs/potree && npx rollup -c && cd ../../..
```

### Step 4: Start the Application

```bash
# Start both frontend and backend servers
pnpm start
```

This runs:
- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:3000

### Step 5: Open in Browser

Navigate to **http://localhost:3000** in Chrome (recommended for WebGL).

### Step 6: Test the Features

| Action | How To |
|--------|--------|
| View point cloud | Should load automatically (lion statue) |
| Rotate view | Click and drag |
| Zoom | Scroll wheel |
| Create annotation | Double-click on the point cloud |
| Add text | Type in the modal, click "Save Note" |
| Edit annotation | Click "Edit" in sidebar |
| Delete annotation | Click "Delete" in sidebar |
| Navigate to annotation | Click "View" or click the annotation marker |
| Test persistence | Refresh the page - annotations should reload |

---

## AWS Deployment

### Prerequisites

- AWS CLI configured with credentials (`aws configure`)
- AWS SAM CLI installed (`pip install aws-sam-cli`)

### Step 1: Deploy Backend

```bash
cd backend

# Install Lambda dependencies
pnpm install --dir src

# Build and deploy (first time - interactive)
sam build
sam deploy --guided
```

During guided deployment:
- **Stack name**: `point-cloud-annotator`
- **Region**: `us-east-1` (or your preferred region)
- **Confirm changes**: `Y`
- **Allow IAM role creation**: `Y`

Note the **API Gateway endpoint URL** from the outputs.

### Step 2: Configure Frontend

Edit `frontend/config.js`:

```javascript
const CONFIG = {
  USE_LOCAL_API: false,  // ← Change to false
  AWS_API_ENDPOINT: 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod',
  // ...
};
```

### Step 3: Deploy Frontend to S3 (Optional)

```bash
# Create S3 bucket
aws s3 mb s3://your-unique-bucket-name

# Enable static website hosting
aws s3 website s3://your-unique-bucket-name --index-document index.html

# Upload frontend (excluding node_modules and Potree .git)
cd frontend
aws s3 sync . s3://your-unique-bucket-name \
  --exclude "node_modules/*" \
  --exclude "libs/potree/.git/*" \
  --exclude "package*.json" \
  --exclude "pnpm-lock.yaml"

# Set public read policy
aws s3api put-bucket-policy --bucket your-unique-bucket-name --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::your-unique-bucket-name/*"
  }]
}'
```

Access at: `http://your-unique-bucket-name.s3-website-us-east-1.amazonaws.com`

---

## API Reference

Base URL: `http://localhost:3001` (local) or your API Gateway URL (AWS)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/annotations` | List all annotations |
| `POST` | `/annotations` | Create new annotation |
| `PUT` | `/annotations/{id}` | Update annotation text |
| `DELETE` | `/annotations/{id}` | Delete annotation |

### Create Annotation

```bash
POST /annotations
Content-Type: application/json

{
  "position": { "x": 1.5, "y": 2.0, "z": 3.5 },
  "text": "Interesting feature here",
  "cameraPosition": { "x": 10, "y": 10, "z": 10 },
  "cameraTarget": { "x": 1.5, "y": 2.0, "z": 3.5 }
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "position": { "x": 1.5, "y": 2.0, "z": 3.5 },
  "text": "Interesting feature here",
  "cameraPosition": { "x": 10, "y": 10, "z": 10 },
  "cameraTarget": { "x": 1.5, "y": 2.0, "z": 3.5 },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Validation

- `position` is required with numeric `x`, `y`, `z` values
- `text` must be ≤ 256 bytes (UTF-8 encoded)

---

## Acceptance Criteria

| Requirement | Status |
|-------------|--------|
| Point cloud loads in Potree viewer | ✅ |
| User can click on any point to add annotation | ✅ |
| User can input/save text (≤256 bytes) | ✅ |
| User can delete annotations | ✅ |
| Annotations reload on page refresh | ✅ |

### Persistence Tier

- [x] **Tier 1**: localStorage _(not implemented - skipped to Tier 3)_
- [x] **Tier 2**: Local backend with JSON DB _(implemented for local dev)_
- [x] **Tier 3**: AWS Lambda + DynamoDB _(implemented)_

### Infrastructure as Code

- [x] AWS SAM template (`backend/template.yaml`)
- [x] Defines: DynamoDB table, Lambda function, API Gateway, IAM policies

---

## AI Tools Used

This project was built with assistance from **Claude** (Anthropic), demonstrating effective use of AI coding assistants:

### How AI Was Used

1. **Architecture Design**: Discussed trade-offs between React vs Vanilla JS, localStorage vs DynamoDB, and chose the optimal stack for the requirements.

2. **Potree Integration**: AI helped navigate Potree's undocumented APIs, particularly:
   - Point cloud picking with `Potree.Utils.getMousePointCloudIntersection()`
   - Annotation creation with correct event handling
   - Understanding the jQuery-based DOM element structure

3. **AWS SAM Template**: Generated the complete `template.yaml` with proper IAM policies, DynamoDB configuration, and API Gateway CORS settings.

4. **Debugging**: Identified version-specific issues (Potree 1.8 API changes) and fixed runtime errors.

5. **Documentation**: This README was drafted with AI assistance to ensure comprehensive coverage of setup steps and technical decisions.



### "No intersection found" on double-click
- Make sure you're clicking directly on the point cloud (the lion statue), not the background
- Try zooming in for better precision


## License

MIT License - feel free to use this code for learning or as a starting point for your own projects.

---

**Built for the Unleash Skills Assessment**
