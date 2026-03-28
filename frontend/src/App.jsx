import { useState, useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import MyBooksPage from './pages/MyBooksPage'
import ReconnectingBanner from './components/ReconnectingBanner'
import { setLeaderUrl, removeFollower, ALL_NODE_URLS } from './api/libraryApi'

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
          // Pings /health endpoint to check for node information
          const res = await fetch(`${url}health`, { signal: AbortSignal.timeout(2000) });
          const data = await res.json();

          // Checks if node is a leader
          // Sets leader url
          // Removes 'Reconnecting' banner
          // Opens connection stream to leader node to listens for updates from backend
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

    // Listens for follower-dead event from the backend
    es.addEventListener('follower-dead', e => {
      const { url } = JSON.parse(e.data)
      removeFollower(url)
      console.log(`[SSE] Follower removed from pool: ${url}`)
    })

    // Listens for new-leader event from the backend
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

      // Remove leader node from node pool
      const deadLeaderUrl = leaderUrl;
      removeFollower(deadLeaderUrl);  
      console.log(`[SSE] Leader removed from pool: ${deadLeaderUrl}`)

      console.warn('[SSE] Leader connection lost — starting election poll...')
      pollForNewLeader()
    }
  }

  // Discover leader firs, then connect SSE
  useEffect(() => {
    async function init() {
      // Poll all nodes to find current leader
      for (const url of ALL_NODE_URLS) {
        try {
          // Pings the /health endpoint to check the status of the node
          const res = await fetch(`${url}health`, {
            signal: AbortSignal.timeout(2000)
          });

          // Gets information about the node linked to the current url
          const data = await res.json();

          // Checks if it's a leader; if yes, it sets the Leader Url to the current url
          // Opens a connection to leader node to receive updates from backend
          if (data.role === 'leader') {
            setLeaderUrl(url);
            connectSSE(url.endsWith('/') ? url : url + '/')
            return
          }
        } catch { /* node unreachable, try next node*/ }
      }

      // No leader found on startup - start polling for new leader
      // connectSSE(getLeaderUrl())
      setReconnecting(true);
      pollForNewLeader();
    }

    init();

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
