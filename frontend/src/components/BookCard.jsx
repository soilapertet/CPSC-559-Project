import React from 'react'

export default function BookCard({ book, onBorrow }) {
  const available = book.availableCopies > 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-base leading-snug">{book.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
            available
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {available ? `${book.availableCopies} available` : 'Unavailable'}
        </span>
      </div>

      <div className="text-sm text-gray-500 space-y-0.5">
        <p>{book.author}</p>
        <p className="flex gap-2">
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{book.genre}</span>
          {book.year && <span className="text-gray-400">{book.year}</span>}
        </p>
      </div>

      {book.description && (
        <p className="text-xs text-gray-400 line-clamp-2">{book.description}</p>
      )}

      <button
        onClick={() => onBorrow(book)}
        disabled={!available}
        className={`mt-auto w-full py-2 rounded-lg text-sm font-medium transition-colors ${
          available
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {available ? 'Borrow' : 'No Copies Left'}
      </button>
    </div>
  )
}
