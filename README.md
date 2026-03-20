# Distributed Library System

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

## Leader:

```
npm run leader
```

Runs on 

```
http://localhost:3001
```

## Followers: 

```
npm run follower1
npm run follower2
```

Run on

```
http://localhost:3002
http://localhost:3003
```

# Health check endpoint:

```
GET /health
```
