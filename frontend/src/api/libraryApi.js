import axios from 'axios'

// Create an axios instance for Leader - write or read operatiosn are directed to the leader
const leaderApi = axios.create({
  // here I hardcode the leader URL,
  // but later it should be dynamic based on the response from election
  // each follower should have its own URL and database
  baseURL: import.meta.env.LEADER_URL || 'http://localhost:3001/',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
})

// Create an axios instance for follower 1 - read operations are directed to follower 1
const follower1Api = axios.create({
  baseURL: import.meta.env.FOLLOWER1_URL || 'http://localhost:3002/',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
})

// Create an axios instance for follower 2 - read operations are directed to follower 2
const follower2Api = axios.create({
  baseURL: import.meta.env.FOLLOWER2_URL || 'http://localhost:3003/',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
})

// Create an axios instance for follower 3 - read operations are directed to follower 2
const follower3Api = axios.create({
  baseURL: import.meta.env.FOLLOWER2_URL || 'http://localhost:3004/',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
})

// Distribute read requests evenly between follower nodes (Load balancing)
const apis = [follower1Api, follower2Api];
let index = 0;

function getApi() {
  return apis[index++ % apis.length]
}

// Run server by: 
// Leader: Start-Process powershell -ArgumentList '-NoExit', '$env:PORT=3001; npm run dev'
// Follower 1: Start-Process powershell -ArgumentList '-NoExit', '$env:PORT=3002; npm run dev'
// Follower 2: Start-Process powershell -ArgumentList '-NoExit', '$env:PORT=3003; npm run dev'

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getAllBooks(params = {}) {

  const follower = getApi();

  if (params && Object.keys(params).length > 0) {
    const key = Object.keys(params)[0];
    try {
      const response = await follower.get('/books/search', {
        params: { [key]: params[key] }
      });
      return { data: { success: true, data: response.data } }

    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        console.warn('Follower timed out, falling back to leader...');
      }
      // try the leader if followers are down
      try {
        const response = await leaderApi.get('/books/search', {
          params: { [key]: params[key] }
        });
        return { data: { success: true, data: response.data } }
      } catch (error) {
        console.error("Error fetching books:", error.response?.data || error.message);
      }
    }
  }
  else {
    try {
      const response = await follower.get('/books');
      return { data: { success: true, data: response.data } }

    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        console.warn('Follower timed out, falling back to leader...');
      }
      // try the leader if followers are down
      try {
        const response = await leaderApi.get('/books');
        return { data: { success: true, data: response.data } }
      } catch (error) {
        console.error("Error fetching books:", error.response?.data || error.message);
      }
    }
  }

}

export async function searchBooks(q, type = 'Keyword') {

  const follower = getApi();

  try {
    let response;
    if (type === 'id') {
      response = await follower.get(`/books/${q}`);
      // make sure the returned data is in array format
      // if response is a single book object, wrap it in an array
      return { data: { success: true, data: response.data ? [response.data] : [] } }
    }
    else {
      response = await follower.get('/books/search', {
        params: { [type.toLowerCase()]: q }
      });
      return { data: { success: true, data: response.data } }
    }
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.warn('Follower timed out, falling back to leader...');
    }
    // try the leader if followers are down
    try {
      let response;
      if (type === 'id') {
        response = await leaderApi.get(`/books/${q}`);
        return { data: { success: true, data: response.data ? [response.data] : [] } }
      }
      else {
        response = await leaderApi.get('/books/search', {
          params: { [type.toLowerCase()]: q }
        });
        return { data: { success: true, data: response.data } }
      }
    } catch (error) {
      console.error("Error searching books:", error.response?.data || error.message);
      return { data: { success: false, data: [] } }
    }
  }
}

export async function loginUser(identifier) {
  // try the leader if follower 1 is down
  const response = await leaderApi.post('/books/user/login', { identifier })
  return response.data
}

export async function registerUser(firstName, lastName, userName, email) {
  const response = await leaderApi.post('/books/user/createuser', { firstName, lastName, userName, email })
  return response.data
}

export async function borrowBook(userId, bookId) {
  return leaderApi.post('/books/borrow', { userId, bookId })
}

export async function returnBook(userId, bookId) {
  return leaderApi.post('/books/return', { userId, bookId })
}

export async function getActiveBorrows(userId) {

  const follower = getApi();

  try {
    return await follower.get(`/borrow/active/${userId}`)
  }
  catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.warn('Follower timed out, falling back to leader...');
    }
    // try the leader if follower 1 is down
    return await leaderApi.get(`/borrow/active/${userId}`)
  }
}

export async function getBorrowHistory(userId) {

  const follower = getApi();

  try {
    return await follower.get(`/borrow/history/${userId}`)
  }
  catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.warn('Follower timed out, falling back to leader...');
    }

    return await leaderApi.get(`/borrow/history/${userId}`)
  }
}

export default leaderApi
