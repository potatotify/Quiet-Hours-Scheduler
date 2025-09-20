'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email?: string
}

interface StudyBlock {
  _id: string
  subject: string
  duration: number
  start_time: string
  end_time: string
  status: string
  created_at: string
  notification_sent?: boolean
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [studyBlocks, setStudyBlocks] = useState<StudyBlock[]>([])
  
  // Form states
  const [subject, setSubject] = useState('')
  const [duration, setDuration] = useState('25')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [creating, setCreating] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        loadStudyBlocks(session.access_token)
      } else {
        router.push('/login')
        return
      }
      setLoading(false)
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/login')
        } else if (session?.user) {
          setUser(session.user)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  // Load study blocks from API
  const loadStudyBlocks = async (token?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = token || session?.access_token
      
      if (!accessToken) return

      const response = await fetch('/api/study-blocks', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStudyBlocks(data.studyBlocks || [])
      }
    } catch (error) {
      console.error('Error loading study blocks:', error)
    }
  }

  // Create new study block
  const handleCreateStudyBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Please log in again')
        return
      }

      const response = await fetch('/api/study-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subject,
          duration,
          date,
          startTime,
          customDuration,
          useCustomTime
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert('Study block created! You will get email reminder 10 minutes before.')
        
        // Reset form
        setSubject('')
        setDuration('25')
        setDate('')
        setStartTime('')
        setCustomDuration('')
        setUseCustomTime(false)
        setShowCreateForm(false)
        
        // Reload study blocks
        loadStudyBlocks()
      } else {
        alert(data.error || 'Failed to create study block')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Something went wrong!')
    } finally {
      setCreating(false)
    }
  }

  // Delete study block
  const deleteStudyBlock = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this study block?')) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/study-blocks', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ blockId })
      })

      const data = await response.json()

      if (response.ok) {
        alert('Study block deleted!')
        loadStudyBlocks() // Refresh the list
      } else {
        alert(data.error || 'Failed to delete study block')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete study block')
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      router.push('/login')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-10 h-10 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Study Blocks</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hi, {user.email?.split('@')[0]}!</span>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-3">Ready to Focus?</h2>
              <p className="text-blue-100 mb-6 text-lg">Schedule your study blocks and get email reminders 10 minutes before each session starts.</p>

              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
              >
                {showCreateForm ? 'Cancel' : '+ Create Study Block'}
              </button>
            </div>
            
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Create New Study Block</h3>
            
            <form onSubmit={handleCreateStudyBlock} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject/Topic</label>
                  <input
                    type="text"
                    placeholder="e.g., Mathematics, Physics, Reading"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                  <div className="space-y-3">
                    <select 
                      value={useCustomTime ? 'custom' : duration}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setUseCustomTime(true)
                        } else {
                          setUseCustomTime(false)
                          setDuration(e.target.value)
                        }
                      }}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                    >
                      <option value="25">25 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                      <option value="120">120 minutes</option>
                      <option value="custom">Custom duration</option>
                    </select>
                    
                    {useCustomTime && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="480"
                          placeholder="Enter minutes"
                          value={customDuration}
                          onChange={(e) => setCustomDuration(e.target.value)}
                          required
                          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                        />
                        <span className="text-gray-500 text-sm">minutes</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button 
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Schedule Study Block'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-8 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Study Blocks List */}
        <div className="space-y-4">
          {studyBlocks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No study blocks yet</h3>
              <p className="text-gray-600 mb-6">Create your first study session!</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
              >
                Create Study Block
              </button>
            </div>
          ) : (
            studyBlocks.map((block) => (
              <div key={block._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{block.subject}</h3>
                      <p className="text-gray-600 text-sm">
                        {block.duration} minutes • {new Date(block.start_time).toLocaleString()}
                      </p>
                      {block.notification_sent && (
                        <p className="text-green-600 text-xs">✅ Notification sent</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                      {block.status}
                    </span>
                    <button
                      onClick={() => deleteStudyBlock(block._id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
                      title="Delete study block"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}