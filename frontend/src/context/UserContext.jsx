import { createContext, useContext, useState } from 'react'
import { loginUser, registerUser } from '../api/libraryApi'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [username, setUsername] = useState(
    () => localStorage.getItem('lms_username') || ''
  )
  const [userId, setUserId] = useState(
    () => localStorage.getItem('lms_userId') || ''
  )

  // Throws if user not found (so callers can show register form)
  async function login(identifier) {
    const data = await loginUser(identifier)
    localStorage.setItem('lms_username', data.userName)
    localStorage.setItem('lms_userId', data.userId)
    setUsername(data.userName)
    setUserId(data.userId)
  }

  async function register(firstName, lastName, userName, email, requestId) {
    await registerUser(firstName, lastName, userName, email, requestId)
    await login(userName)
  }

  function logout() {
    localStorage.removeItem('lms_username')
    localStorage.removeItem('lms_userId')
    setUsername('')
    setUserId('')
  }

  return (
    <UserContext.Provider value={{ username, userId, login, register, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
