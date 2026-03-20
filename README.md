# Distributed Library System

## Repository Setup

Clone the repository from Github

```
git clone https://github.com/soilapertet/CPSC-559-Project.git
```

### Prerequisites

- Node.js 18+

- npm

## Frontend Setup

```
cd CPSC-559-PROJECT
cd frontend
npm install
npm run dev
```

If successful, the frontend will run at:

```
http://localhost:5173/
```

## Backend Setup
1. Create an environment folder in the backend folder

```
cd backend
```
2. Create three.env file inside the backend folder
   - leader.env
   - follower1.env
   - follower2.env
4. Add the following to the .env file:
```
PORT=5000
```

4.  Install and run:

Run server by: 
4.1 Leader:
```
Start-Process powershell -ArgumentList '-NoExit', '$env:PORT=3001; npm run dev'
```

4.2 Follower i: 
```
Start-Process powershell -ArgumentList '-NoExit', '$env:PORT=<3002>; npm run dev'
```

```
Start-Process powershell -ArgumentList '-NoExit', '$env:PORT=<3003>; npm run dev'
```

If successful, the leader server will run at:
```
http://localhost:3001
```
and the followers will run at:
```
http://localhost:3002
http://localhost:3003
```

Health check endpoint:
```
GET /health
```
