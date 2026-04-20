import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import TransactionTable from '../components/TransactionTable'
import AuthModal from '../components/AuthModal'
import { useUser } from '../context/UserContext'
import { getActiveBorrows, getBorrowHistory, returnBook } from '../api/libraryApi'

export default function MyBooksPage() {
  const { username, userId } = useUser()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('active')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (userId) fetchTransactions()
  }, [userId, activeTab])

  async function fetchTransactions() {
    setLoading(true)
    try {
      const res = activeTab === 'active'
        ? await getActiveBorrows(userId)
        : await getBorrowHistory(userId)
      setTransactions(res.data)
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  async function handleReturn(bookId) {

    // Genereate a request id for the return request
    const request_id = uuidv4();

    try {
      const res  = await returnBook(userId, bookId, request_id);
      setSuccessMsg(res.data.message);
      setErrorMsg('');              // clear any previous error message

      fetchTransactions()
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch(err) {
      const message = err.response?.data?.error || "Failed to return book. Please try again.";
      setErrorMsg(message);
      setSuccessMsg('');            // clear any previous success message
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }

  if (!userId) {
    return (
      <div className="max-w-sm mx-auto mt-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <AuthModal onSuccess={fetchTransactions} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">My Books</h1>
          <p className="text-sm text-gray-500">Borrowed books for <span className="font-medium">{username}</span></p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          ← Browse Books
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          History
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : (
        <TransactionTable
          transactions={transactions}
          onReturn={handleReturn}
          showReturnButton={activeTab === 'active'}
        />
      )}
    </div>
  )
}
