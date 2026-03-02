import axios from 'axios'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_BOOKS = [
  { _id: '1', title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', genre: 'Technology', year: 2008, totalCopies: 3, availableCopies: 3, description: 'A handbook of agile software craftsmanship.' },
  { _id: '2', title: 'The Pragmatic Programmer', author: 'David Thomas', isbn: '9780135957059', genre: 'Technology', year: 2019, totalCopies: 2, availableCopies: 2, description: 'Your journey to mastery.' },
  { _id: '3', title: 'Design Patterns', author: 'Gang of Four', isbn: '9780201633610', genre: 'Technology', year: 1994, totalCopies: 4, availableCopies: 4, description: 'Elements of Reusable Object-Oriented Software.' },
  { _id: '4', title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', genre: 'Science Fiction', year: 1965, totalCopies: 5, availableCopies: 5, description: 'A sprawling epic set in a distant future.' },
  { _id: '5', title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '9780547928227', genre: 'Fantasy', year: 1937, totalCopies: 3, availableCopies: 3, description: "A hobbit's unexpected journey." },
  { _id: '6', title: 'Sapiens', author: 'Yuval Noah Harari', isbn: '9780062316097', genre: 'History', year: 2011, totalCopies: 2, availableCopies: 2, description: 'A brief history of humankind.' },
  { _id: '7', title: '1984', author: 'George Orwell', isbn: '9780451524935', genre: 'Fiction', year: 1949, totalCopies: 4, availableCopies: 4, description: 'A dystopian social science fiction novel.' },
  { _id: '8', title: 'Introduction to Algorithms', author: 'CLRS', isbn: '9780262033848', genre: 'Technology', year: 2009, totalCopies: 3, availableCopies: 3, description: 'The standard algorithms textbook.' },
]

// In-memory mock state (simulates DB for development)
let mockBooks = MOCK_BOOKS.map(b => ({ ...b }))
let mockTransactions = []
let nextTxId = 1

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockDelay(ms = 200) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getAllBooks(params = {}) {
  if (USE_MOCK) {
    await mockDelay()
    let books = [...mockBooks]
    if (params.genre) books = books.filter(b => b.genre === params.genre)
    if (params.available === 'true') books = books.filter(b => b.availableCopies > 0)
    return { data: { success: true, data: books } }
  }
  return api.get('/books', { params })
}

export async function searchBooks(q, type = 'Keyword') {
  if (USE_MOCK) {
    await mockDelay()
    const lower = q.toLowerCase()
    const results = mockBooks.filter(b => {
      switch (type) {
        case 'Title':   return b.title.toLowerCase().includes(lower)
        case 'Author':  return b.author.toLowerCase().includes(lower)
        case 'Subject': return b.genre.toLowerCase().includes(lower)
        case 'ISBN':    return b.isbn.includes(q)
        default:        // Keyword — search everything
          return (
            b.title.toLowerCase().includes(lower) ||
            b.author.toLowerCase().includes(lower) ||
            b.genre.toLowerCase().includes(lower) ||
            b.isbn.includes(q) ||
            b.description.toLowerCase().includes(lower)
          )
      }
    })
    return { data: { success: true, data: results } }
  }
  return api.get('/books/search', { params: { q, type } })
}

export async function borrowBook(username, bookId) {
  if (USE_MOCK) {
    await mockDelay()
    const book = mockBooks.find(b => b._id === bookId)
    if (!book) return { data: { success: false, message: 'Book not found' } }
    const alreadyBorrowed = mockTransactions.find(
      t => t.username === username && t.bookId === bookId && t.status === 'active'
    )
    if (alreadyBorrowed) return { data: { success: false, message: 'You already have this book borrowed' } }
    if (book.availableCopies <= 0) return { data: { success: false, message: 'No copies available' } }

    book.availableCopies -= 1
    const tx = {
      _id: String(nextTxId++),
      username,
      bookId,
      bookTitle: book.title,
      borrowedAt: new Date().toISOString(),
      returnedAt: null,
      status: 'active',
    }
    mockTransactions.push(tx)
    return { data: { success: true, data: tx } }
  }
  return api.post('/borrow', { username, bookId })
}

export async function returnBook(username, bookId) {
  if (USE_MOCK) {
    await mockDelay()
    const tx = mockTransactions.find(
      t => t.username === username && t.bookId === bookId && t.status === 'active'
    )
    if (!tx) return { data: { success: false, message: 'No active borrow record found' } }

    tx.status = 'returned'
    tx.returnedAt = new Date().toISOString()
    const book = mockBooks.find(b => b._id === bookId)
    if (book) book.availableCopies += 1
    return { data: { success: true, data: tx } }
  }
  return api.post('/return', { username, bookId })
}

export async function getActiveBorrows(username) {
  if (USE_MOCK) {
    await mockDelay()
    const active = mockTransactions.filter(
      t => t.username === username && t.status === 'active'
    )
    return { data: { success: true, data: active } }
  }
  return api.get(`/borrow/active/${username}`)
}

export async function getBorrowHistory(username) {
  if (USE_MOCK) {
    await mockDelay()
    const history = mockTransactions
      .filter(t => t.username === username)
      .sort((a, b) => new Date(b.borrowedAt) - new Date(a.borrowedAt))
    return { data: { success: true, data: history } }
  }
  return api.get(`/borrow/history/${username}`)
}

export async function registerUser(username) {
  if (USE_MOCK) {
    await mockDelay(50)
    return { data: { success: true, data: { username } } }
  }
  return api.post('/users/register', { username })
}

export default api
