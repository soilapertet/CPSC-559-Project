import axios from 'axios'

// All known node URLs — used to poll for new leader during election
export const ALL_NODE_URLS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005'
]

// Generate a dynamic dictionary where key = URL and value = axios instance
export const NODE_URL_MAPPING = Object.fromEntries(
  
  // Create an array such that [url, axiosInstance]
  // Create an object from this array to map urls to their axios instances
  ALL_NODE_URLS.map(url => [
    url,
    axios.create({
      baseUrl: url,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    })
  ])
);

const leaderApi = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Access all axios instances from NODE_URL_MAPPING object
const apis = Object.values(NODE_URL_MAPPING); 
let index = 0;

// Normalize URLs to minimise future errors
function normalizeUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

// Distribute read requests evenly between follower nodes (Load balancing)
function getApi() {
  if (apis.length === 0) return leaderApi  // all followers dead — fall back to leader
  return apis[index++ % apis.length]
}

// ─── Dynamic leader/follower management (called by SSE event handler in App.jsx) ─

export function setLeaderUrl(url) {
  const base = normalizeUrl(url);
  leaderApi.defaults.baseURL = base
}

export function getLeaderUrl() {
  return leaderApi.defaults.baseURL;
}

export function removeFollower(url) {
  const base = normalizeUrl(url);
  apis = apis.filter(api => api.defaults.baseURL !== base);
}

export function addFollower(url) {
  const base = normalizeUrl(url);
  const api = NODE_URL_MAPPING[base];
  
  if(!api) {
    console.warn(`No API instance found for ${base}`);
    return;
  }

  // Check for duplication
  const exists = apis.some(api => api.defaults.baseURL === base);
  if(exists) return

  // Add back api instance after recovery
  apis.push(api);
  console.log(`[Frontend] Follower added back: ${base}`);
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getAllBooks(params = {}) {
  const follower = getApi()
  if (params && Object.keys(params).length > 0) {
    const key = Object.keys(params)[0]
    const response = await follower.get('/books/search', { params: { [key]: params[key] } })
    return { data: { success: true, data: response.data } }
  } else {
    const response = await follower.get('/books')
    return { data: { success: true, data: response.data } }
  }
}

export async function searchBooks(q, type = 'Keyword') {
  const follower = getApi()
  if (type === 'id') {
    const response = await follower.get(`/books/${q}`)
    return { data: { success: true, data: response.data ? [response.data] : [] } }
  } else {
    const response = await follower.get('/books/search', { params: { [type.toLowerCase()]: q } })
    return { data: { success: true, data: response.data } }
  }
}

export async function loginUser(identifier) {
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
  const follower = getApi()
  return follower.get(`/borrow/active/${userId}`)
}

export async function getBorrowHistory(userId) {
  const follower = getApi()
  return follower.get(`/borrow/history/${userId}`)
}

export default leaderApi
