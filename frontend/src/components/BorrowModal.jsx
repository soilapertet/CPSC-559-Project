import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { borrowBook } from '../api/libraryApi'
import AuthModal from './AuthModal'

export default function BorrowModal({ book, onClose, onSuccess }) {
  const { userId } = useUser()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState(!!userId)

  // After auth flow completes, update local authed state
  function handleAuthSuccess() {
    setAuthed(true)
  }

  async function handleConfirm() {
    setError('')
    setLoading(true)
    try {
      const res = await borrowBook(userId, book._id)
      if (res.data?.message === 'Book borrowed successfully') {
        onSuccess()
      } else {
        setError(res.data?.error || 'Failed to borrow book.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Server error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {!authed ? (
          <AuthModal onSuccess={handleAuthSuccess} />
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Borrow Book</h2>
            <p className="text-sm text-gray-500 mb-5">
              You are about to borrow <span className="font-medium text-gray-800">"{book.title}"</span> by {book.author}.
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loading ? 'Borrowing...' : 'Confirm Borrow'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
