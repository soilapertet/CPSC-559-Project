import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function Navbar() {
  const { username, logout } = useUser()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-indigo-700 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold tracking-tight hover:text-indigo-200">
            UniLib
          </Link>
          <div className="flex gap-6 text-sm font-medium">
            <Link to="/" className="hover:text-indigo-200 transition-colors">
              Browse Books
            </Link>
            <Link to="/my-books" className="hover:text-indigo-200 transition-colors">
              My Books
            </Link>
          </div>
        </div>

        <div className="text-sm">
          {username ? (
            <div className="flex items-center gap-3">
              <span className="text-indigo-200">
                Logged in as <span className="font-semibold text-white">{username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded text-xs transition-colors"
              >
                Change User
              </button>
            </div>
          ) : (
            <Link
              to="/my-books"
              className="bg-white text-indigo-700 font-semibold px-3 py-1 rounded text-xs hover:bg-indigo-100 transition-colors"
            >
              Set Username
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
