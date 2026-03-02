import React from 'react'

export default function TransactionTable({ transactions, onReturn, showReturnButton = true }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No records found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">Book Title</th>
            <th className="px-4 py-3 text-left">Borrowed</th>
            <th className="px-4 py-3 text-left">Status</th>
            {showReturnButton && <th className="px-4 py-3 text-left">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {transactions.map(tx => (
            <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{tx.bookTitle}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(tx.borrowedAt).toLocaleDateString('en-CA', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    tx.status === 'active'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tx.status === 'active' ? 'Active' : 'Returned'}
                </span>
              </td>
              {showReturnButton && (
                <td className="px-4 py-3">
                  {tx.status === 'active' && (
                    <button
                      onClick={() => onReturn(tx.bookId)}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg transition-colors"
                    >
                      Return
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
