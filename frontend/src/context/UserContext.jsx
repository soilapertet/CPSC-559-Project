import { createContext, useContext, useState } from 'react'
import { registerUser } from '../api/libraryApi'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [username, setUsername] = useState(
    () => localStorage.getItem('lms_username') || ''
  )

  async function login(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    await registerUser(trimmed)
    localStorage.setItem('lms_username', trimmed)
    setUsername(trimmed)
  }

  function logout() {
    localStorage.removeItem('lms_username')
    setUsername('')
  }

  return (
    <UserContext.Provider value={{ username, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
