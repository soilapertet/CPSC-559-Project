# Distributed Library System

A fault-tolerant distributed system that supports book borrowing, returning, and user management using leader-based replication, the Bully election algorithm, and write-ahead logging (WAL) for consistency.

---

## System Overview

This system is built using a **leader–follower architecture**:

* **Leader node**

  * Handles all write operations
  * Replicates updates to followers
* **Follower nodes**

  * Maintain replicated state
  * Can serve read requests

Key features:

* Leader election using **Bully Algorithm**
* **Synchronous replication**
* **Idempotency** using request IDs
* **Locking mechanism** to prevent double booking
* **Fault tolerance** with automatic failover
* **Real-time updates** via Server-Sent Events (SSE)

---

## Prerequisites

* Node.js 18+
* npm
* MongoDB Atlas (or MongoDB instance)
* Tailscale (for multi-machine communication)

---

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

## Backend Setup (Distributed)

Each node runs on a **separate machine**.

### 1. Clone repository on each machine

```bash
git clone https://github.com/soilapertet/CPSC-559-Project.git
cd CPSC-559-Project/backend
npm install
```

---

### 2. Configure environment variables

On each machine, create an `env/` folder and add a `.env` file inside it.

Example:

```env
PORT=3001
ROLE=follower

NODE0_URL=http://100.x.x.x:3001
NODE1_URL=http://100.x.x.x:3002
NODE2_URL=http://100.x.x.x:3003

MONGODB_URI=your_mongodb_connection_string
```

Notes:

* Each machine must use a **different PORT**
* All nodes must share the **same NODE URLs**
* Use **Tailscale IPs (100.x.x.x)**, NOT localhost

---

### 3. Start backend (on each machine)

```bash
npm run dev
```

---

## What Happens on Startup

1. All nodes start as followers
2. Nodes check for an existing leader
3. If no leader is found:

   * Bully election is triggered
4. Node with **highest port becomes leader**
5. Heartbeat monitoring begins

---

## Testing the System

### Leader Election

* Start all nodes
* Highest port becomes leader
* Stop leader → new leader elected automatically

---

### Fault Tolerance

* Kill leader during operation
* System recovers and elects new leader

---

### Double Booking Prevention

* Attempt to borrow same book from multiple clients
* Only one request succeeds

---

## API Overview

### Write Operations (Leader Only)

* `POST /books/borrow`
* `POST /books/return`
* `POST /books/createUser`

---

### Read Operations (Any Node)

* `GET /books`
* `GET /books/search`
* `GET /borrow/active/:userId`
* `GET /borrow/history/:userId`

---

## Health Check

```
GET /health
```

## Key Distributed Concepts

* Leader-based replication
* Bully election algorithm
* Idempotency using request IDs
* Atomic transactions and rollback
* Pessimistic locking
* Failure detection via heartbeat
* Event-driven updates (SSE)

---
