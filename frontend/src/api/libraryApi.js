import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000,
})

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getAllBooks(params = {}) {
  try {
    if (params && Object.keys(params).length > 0) {
      const key = Object.keys(params)[0];
      const response = await api.get('/books/search', {
        params: { [key]: params[key] }
      });
      return { data: { success: true, data: response.data } }
    }

    const response = await api.get('/books');
    return { data: { success: true, data: response.data } }
  } catch (error) {
    console.error("Error fetching books:", error.response?.data || error.message);
  }
}

export async function searchBooks(q, type = 'Keyword') {
  try {
    const response = await api.get('/books/search', {
      params: { [type.toLowerCase()]: q }
    })
    return { data: { success: true, data: response.data } }
  } catch (error) {
    console.error("Error searching books:", error.response?.data || error.message);
  }
}

export async function loginUser(identifier) {
  const response = await api.post('/books/user/login', { identifier })
  return response.data
}

export async function registerUser(firstName, lastName, userName, email) {
  const response = await api.post('/books/user/createuser', { firstName, lastName, userName, email })
  return response.data
}

export async function borrowBook(userId, bookId) {
  return api.post('/books/borrow', { userId, bookId })
}

export async function returnBook(userId, bookId) {
  return api.post('/books/return', { userId, bookId })
}

export async function getActiveBorrows(userId) {
  return api.get(`/borrow/active/${userId}`)
}

export async function getBorrowHistory(userId) {
  return api.get(`/borrow/history/${userId}`)
}

export default api
