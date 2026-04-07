# Distributed Library System

A fault-tolerant distributed system that supports book borrowing, returning, and user management using leader-based replication, Bully election, and write-ahead logging (WAL) for consistency.

## Repository Setup

Clone the repository from Github

```
git clone https://github.com/soilapertet/CPSC-559-Project.git
cd CPSC-559-Project
```

### Prerequisites

- Node.js 18+

- npm

## Frontend Setup
1. Navigate to frontend folder 

```
cd frontend
```
2. Install dependencies

```
npm install
```

3. Start the development server

```
npm run dev
```

The frontend will run at:

```
http://localhost:5173/
```

## Backend Setup
1. Navigate to backend folder

```
cd backend
```

2. Install dependencies

```
npm install
```

3. Copy example environment files

```
cp -r env.example/ env/
```

3. Update the values inside the env/ folder
   
# Running the servers

Start all nodes

```
npm run start
```

Nodes will run on 

```
http://localhost:3001
http://localhost:3002
http://localhost:3003
http://localhost:3004
http://localhost:3005
```

## What happens on startup

- All nodes start as followers
- Nodes check for an existing leader
- If none is found:
     - Bully election is triggered
- Leader is elected automatically
- Heartbeat monitoring begins

# API Overview

## Write Operations 
 Directed to leader node only

 - POST /books/borrow
 - POST /books/return
 - POST /books/createUser

## Read Operations 
 Directed to any node (leader or follower

 - GET /books
 - GET /books/search
 - GET /borrow/active/:userId
 - GET /borrow/history/:userId
   
# Health check endpoint:

```
GET /health
```
