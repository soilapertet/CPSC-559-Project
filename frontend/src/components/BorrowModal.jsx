import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { borrowBook } from '../api/libraryApi'

export default function BorrowModal({ book, onClose, onSuccess }) {
  const { username, login } = useUser()
  const [tempUsername, setTempUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setError('')
    let user = username

    if (!user) {
      if (!tempUsername.trim()) {
        setError('Please enter your username.')
        return
      }
      await login(tempUsername.trim())
      user = tempUsername.trim()
    }

    setLoading(true)
    try {
      const res = await borrowBook(user, book._id)
      if (res.data.success) {
        onSuccess()
      } else {
        setError(res.data.message || 'Failed to borrow book.')
      }
    } catch (err) {
      setError('Server error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Borrow Book</h2>
        <p className="text-sm text-gray-500 mb-5">
          You are about to borrow <span className="font-medium text-gray-800">"{book.title}"</span> by {book.author}.
        </p>

        {!username && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your username
            </label>
            <input
              type="text"
              value={tempUsername}
              onChange={e => setTempUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>
        )}

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
      </div>
    </div>
  )
}
