import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionTable from '../components/TransactionTable'
import { useUser } from '../context/UserContext'
import { getActiveBorrows, getBorrowHistory, returnBook } from '../api/libraryApi'

export default function MyBooksPage() {
  const { username, login } = useUser()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('active')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [tempUsername, setTempUsername] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (username) fetchTransactions()
  }, [username, activeTab])

  async function fetchTransactions() {
    setLoading(true)
    try {
      const res = activeTab === 'active'
        ? await getActiveBorrows(username)
        : await getBorrowHistory(username)
      setTransactions(res.data.data)
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  async function handleReturn(bookId) {
    try {
      const res = await returnBook(username, bookId)
      if (res.data.success) {
        setSuccessMsg('Book returned successfully!')
        fetchTransactions()
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    } catch {
      // silently ignore for now
    }
  }

  async function handleLogin() {
    setLoginError('')
    if (!tempUsername.trim()) {
      setLoginError('Please enter a username.')
      return
    }
    await login(tempUsername.trim())
  }

  if (!username) {
    return (
      <div className="max-w-sm mx-auto mt-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Set Your Username</h2>
        <p className="text-sm text-gray-500 mb-5">
          Enter a username to view and manage your borrowed books.
        </p>
        <input
          type="text"
          value={tempUsername}
          onChange={e => setTempUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="e.g. alice"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          autoFocus
        />
        {loginError && (
          <p className="text-xs text-red-500 mb-3">{loginError}</p>
        )}
        <button
          onClick={handleLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Continue
        </button>
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
