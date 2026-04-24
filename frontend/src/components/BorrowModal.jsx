import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useUser } from '../context/UserContext'
import { borrowBook } from '../api/libraryApi'
import AuthModal from './AuthModal'
import { retryRequest } from '../utils/retryRequest'

export default function BorrowModal({ book, onClose, onSuccess }) {
  const { userId } = useUser()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState(!!userId)
  const [requestId, setRequestId] = useState(null)
  const [retrying, setRetrying] = useState(false)

  // After auth flow completes, update local authed state
  function handleAuthSuccess() {
    setAuthed(true)
  }

  async function handleConfirm() {
    setError('')
    setLoading(true)
    setRetrying(false)

    // Generate request id for borrow request (only one)
    let id = requestId;
    if (!id) {
      id = uuidv4();
      setRequestId(id);
    }

    try {
      let firstAttempt = true;

      await retryRequest(async () => {
        try {
          return await borrowBook(userId, book._id, id)
        } catch (err) {
          if (firstAttempt && err.code === 'ECONNABORTED') {
            setRetrying(true);
          }
          firstAttempt = false;
          throw err;
        }
      });

      setRequestId(null);
      setRetrying(false);
      setError('');
      onSuccess();

    } catch (err) {

      setRetrying(false);
      const message = err.response?.data?.error || err.message || 'Failed to borrow book. Please try again.';
      setError(message);

    } finally {

      setLoading(false);

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

            {retrying && (
              <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                Leader crashed, retrying...
              </p>
            )}

            {error && !retrying && (
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
              {!error ? (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Borrowing...' : 'Confirm Borrow'}
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
