import { useState, useEffect, useRef } from 'react'

const SEARCH_TYPES = ['Keyword', 'Title', 'Author', 'Subject', 'ISBN']

export default function SearchBar({ onSearch, placeholder }) {
  const [value, setValue] = useState('')
  const [searchType, setSearchType] = useState('Keyword')
  const timerRef = useRef(null)

  const resolvedPlaceholder = placeholder || `Search by ${searchType.toLowerCase()}...`

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearch(value, searchType)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [value, searchType])

  function handleClear() {
    setValue('')
    onSearch('', searchType)
  }

  return (
    <div className="flex rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
      {/* Dropdown */}
      <div className="relative border-r border-gray-200">
        <select
          value={searchType}
          onChange={e => setSearchType(e.target.value)}
          className="h-full appearance-none bg-gray-50 text-gray-700 text-sm font-medium pl-3 pr-8 cursor-pointer focus:outline-none"
        >
          {SEARCH_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        {/* Custom chevron */}
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {/* Search icon + input */}
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={resolvedPlaceholder}
          className="w-full pl-10 pr-10 py-3 bg-white text-sm focus:outline-none"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
