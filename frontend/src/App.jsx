import { useState, useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import MyBooksPage from './pages/MyBooksPage'
import ReconnectingBanner from './components/ReconnectingBanner'
import { setLeaderUrl, getLeaderUrl, removeFollower, ALL_NODE_URLS } from './api/libraryApi'

export default function App() {
  const [reconnecting, setReconnecting] = useState(false)
  const sseRef = useRef(null)
  const pollRef = useRef(null)

  function pollForNewLeader() {
    // clear any existing poll
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      for (const url of ALL_NODE_URLS) {
        try {
          const res = await fetch(`${url}health`, { signal: AbortSignal.timeout(2000) })
          const data = await res.json()
          if (data.role === 'leader') {
            setLeaderUrl(url)
            setReconnecting(false)
            clearInterval(pollRef.current)
            connectSSE(url)
            return
          }
        } catch { /* node unreachable, try next */ }
      }
    }, 2000)
  }

  function connectSSE(leaderUrl) {
    if (sseRef.current) sseRef.current.close()

    const es = new EventSource(`${leaderUrl}events`)
    sseRef.current = es

    es.addEventListener('follower-dead', e => {
      const { url } = JSON.parse(e.data)
      removeFollower(url)
      console.log(`[SSE] Follower removed from pool: ${url}`)
    })

    es.addEventListener('new-leader', e => {
      const { url } = JSON.parse(e.data)
      setLeaderUrl(url)
      setReconnecting(false)
      console.log(`[SSE] New leader elected: ${url}`)
      connectSSE(url.endsWith('/') ? url : url + '/')
    })

    es.onerror = () => {
      es.close()
      setReconnecting(true)
      console.warn('[SSE] Leader connection lost — starting election poll...')
      pollForNewLeader()
    }
  }

  useEffect(() => {
    connectSSE(getLeaderUrl())
    return () => {
      sseRef.current?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {reconnecting && <ReconnectingBanner />}
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/my-books" element={<MyBooksPage />} />
        </Routes>
      </main>
    </div>
  )
}
