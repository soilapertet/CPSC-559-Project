import { useState, useEffect } from 'react'
import SearchBar from '../components/SearchBar'
import BookCard from '../components/BookCard'
import BorrowModal from '../components/BorrowModal'
import { getAllBooks, searchBooks } from '../api/libraryApi'

const GENRES = ['All', 'Technology', 'Fiction', 'Science Fiction', 'Fantasy', 'History']

export default function HomePage() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetchBooks()
  }, [selectedGenre])

  async function fetchBooks() {
    setLoading(true)
    try {
      const params = {}
      if (selectedGenre !== 'All') params.genre = selectedGenre
      const res = await getAllBooks(params)
      setBooks(res.data.data)
    } catch {
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(q, type) {
    setSearchQuery(q)
    if (!q.trim()) {
      fetchBooks()
      return
    }
    setLoading(true)
    try {
      const res = await searchBooks(q, type)
      setBooks(res.data.data)
    } catch {
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

  function handleBorrowSuccess() {
    setSelectedBook(null)
    setSuccessMsg(`"${selectedBook.title}" borrowed successfully!`)
    fetchBooks()
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Browse Books</h1>
        <p className="text-sm text-gray-500">Search and borrow from our catalogue</p>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          {successMsg}
        </div>
      )}

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
      </div>

      {!searchQuery && (
        <div className="flex gap-2 flex-wrap mb-6">
          {GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedGenre === genre
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading books...</div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No books found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {books.map(book => (
            <BookCard key={book._id} book={book} onBorrow={setSelectedBook} />
          ))}
        </div>
      )}

      {selectedBook && (
        <BorrowModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSuccess={handleBorrowSuccess}
        />
      )}
    </div>
  )
}
