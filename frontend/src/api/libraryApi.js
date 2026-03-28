import axios from 'axios'

// All known node URLs — used to poll for new leader during election
export const ALL_NODE_URLS = [
  'http://localhost:3001/',
  'http://localhost:3002/',
  'http://localhost:3003/',
  'http://localhost:3004/',
  'http://localhost:3005',
]

const leaderApi = axios.create({
  baseURL: 'http://localhost:3001/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

const follower1Api = axios.create({
  baseURL: 'http://localhost:3002/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

const follower2Api = axios.create({
  baseURL: 'http://localhost:3003/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// Create an axios instance for follower 3 - read operations are directed to follower 3
const follower3Api = axios.create({
  baseURL: 'http://localhost:3004/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// Create an axios instance for follower 4 - read operations are directed to follower 4
const follower4Api = axios.create({
  baseURL: import.meta.env.FOLLOWER4_URL || 'http://localhost:3005/',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
})

// Distribute read requests evenly between follower nodes (Load balancing)
const apis = [follower1Api, follower2Api, follower3Api, follower4Api];
let index = 0;

function getApi() {
  if (apis.length === 0) return leaderApi  // all followers dead — fall back to leader
  return apis[index++ % apis.length]
}

// ─── Dynamic leader/follower management (called by SSE event handler in App.jsx) ─

export function setLeaderUrl(url) {
  const base = url.endsWith('/') ? url : url + '/'
  leaderApi.defaults.baseURL = base
}

export function getLeaderUrl() {
  return leaderApi.defaults.baseURL
}

export function removeFollower(url) {
  const base = url.endsWith('/') ? url : url + '/'
  const i = apis.findIndex(a => a.defaults.baseURL === base)
  if (i !== -1) apis.splice(i, 1)
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
