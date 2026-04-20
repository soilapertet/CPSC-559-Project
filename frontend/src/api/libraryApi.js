import axios from 'axios'

// All known node URLs — used to poll for new leader during election
export const ALL_NODE_URLS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
]

// Generate a dynamic dictionary where key = URL and value = axios instance
export const NODE_URL_MAPPING = Object.fromEntries(
  
  // Create an array such that [url, axiosInstance]
  // Create an object from this array to map urls to their axios instances
  ALL_NODE_URLS.map(url => [
    url,
    axios.create({
      baseURL: url,
      headers: { 'Content-Type': 'application/json' },
      timeout: 1500,
    })
  ])
);

const leaderApi = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 1500,
});

// Dynamic pool of Axios instances for active follower nodes
let apis = [];
let index = 0;
let isInitialized = false;      // Flag for leader discovery

// Block API calls until leader is discovered
let resolveInit;
let initializationPromise = new Promise((resolve) => {
  resolveInit = resolve;
});

// Normalize URLs to minimise future errors
function normalizeUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

// Distribute read requests evenly between follower nodes (Load balancing)
// Uses quorum to prevent stale reads
async function getApi() {
  // Wait for leader discovery
  if (!isInitialized) {
    console.warn("[Frontend] Waiting for leader discovery...");
    await initializationPromise;
  }

  // Initialize list of candidates
  const candidates = [...apis];

  // Only the leader is active
  if (candidates.length === 0) return leaderApi;

  // Add leader to candidates list for quorum and sequence number check
  const leaderBase = leaderApi.defaults.baseURL;
  if (leaderBase && !candidates.some(a => a.defaults.baseURL === leaderBase)) {
    candidates.push(leaderApi)
  }

  // Calculate quorum for reads
  const N = candidates.length; 
  const R = Math.floor(N/2) + 1;

  // Get candidates' latest sequences applied
  const checks = candidates.map(async (api) => {
    try {
      const res = await axios.get(`${api.defaults.baseURL}/health`, { timeout: 600 });
      return { api, seq: res.data.seq, role: res.data.role || 0 };
    } catch {
      return null;
    }
  });

  // Get all non-null results
  const results = (await Promise.all(checks)).filter(r => r !== null);

  if (results.length < R) {
    leaderFallback = true;
    console.warn(`[API] Falling back to leader. Only ${results.length}/${N} nodes responded.`);
    return leaderApi;
  }

  // Get most up-to-date sequence
  const maxSeq = Math.max(...results.map(r => r.seq));

  // Filter for up-to-date non-leader nodes
  const upToDateNodes = results.filter(r => r.seq === maxSeq && r.role !== 'leader');

  if (upToDateNodes.length === 0) {
    console.log(`[API] Falling back to leader. Only leader is up-to-date.`);
    return leaderApi;
  }

  // Select node with round-robin
  const selected = upToDateNodes[index++ % upToDateNodes.length];
  return selected.api;
}

// ─── Dynamic leader/follower management (called by SSE event handler in App.jsx) ─

export function setLeaderUrl(url) {
  const base = normalizeUrl(url);
  leaderApi.defaults.baseURL = base
  isInitialized = true;
  removeFollower(base);
  console.log(`[Frontend] Leader discovered: ${base}`)
  resolveInit();
}

export function getLeaderUrl() {
  return leaderApi.defaults.baseURL;
}

export function removeFollower(url) {
  const base = normalizeUrl(url);
  apis = apis.filter(api => api.defaults.baseURL !== base);
  console.log(`[Frontend] Removing follower: ${base}`);
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
  const follower = await getApi()
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
  const follower = await getApi()
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
  const follower = await getApi()
  return follower.get(`/borrow/active/${userId}`)
}

export async function getBorrowHistory(userId) {
  const follower = await getApi()
  return follower.get(`/borrow/history/${userId}`)
}

export default leaderApi
