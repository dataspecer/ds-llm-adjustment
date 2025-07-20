'use client'

import { useState, useEffect, useRef } from 'react'
import { api, ChatConversation, SchemaChangeDto } from '../services/api'

interface LlmChatProps {
  changes: SchemaChangeDto[]
  selectedChangeIds: string[]
  onClose: () => void
  isOpen: boolean
}

export default function LlmChat({ changes, selectedChangeIds, onClose, isOpen }: LlmChatProps) {
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation?.messages])

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  const startChat = async (customPrompt?: string) => {
    if (selectedChangeIds.length === 0) {
      setError('Please select at least one change to discuss.')
      return
    }

    setIsStartingChat(true)
    setError(null)

    try {
      const selectedChanges = changes.filter(c => selectedChangeIds.includes(c.id))
      
      const response = await api.startChat({
        changeIds: selectedChangeIds,
        changes: selectedChanges,
        initialPrompt: customPrompt,
      })

      if (response.error) {
        throw new Error(response.error)
      }

      if (response.data) {
        setConversation(response.data)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start chat')
    } finally {
      setIsStartingChat(false)
    }
  }

  const sendMessage = async () => {
    if (!message.trim() || !conversation) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await api.sendMessage({
        conversationId: conversation.id,
        message: message.trim(),
      })

      if (response.error) {
        throw new Error(response.error)
      }

      if (response.data) {
        setConversation(response.data)
        setMessage('')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getChangesSummary = () => {
    const selectedChanges = changes.filter(c => selectedChangeIds.includes(c.id))
    const types = [...new Set(selectedChanges.map(c => c.type))]
    return `${selectedChanges.length} change${selectedChanges.length !== 1 ? 's' : ''} (${types.join(', ')})`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">AI Assistant</h2>
            <p className="text-sm text-gray-400">
              Discussing {getChangesSummary()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {!conversation ? (
            /* Initial state */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-zinc-800 rounded-lg p-6 max-w-md">
                <div className="text-blue-400 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Get AI insights on your changes
                </h3>
                <p className="text-gray-400 mb-6">
                  Start a conversation to get expert analysis and recommendations for your schema changes.
                </p>
                <button
                  onClick={() => startChat()}
                  disabled={isStartingChat || selectedChangeIds.length === 0}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isStartingChat ? 'Starting Chat...' : 'Start AI Analysis'}
                </button>
                {selectedChangeIds.length === 0 && (
                  <p className="text-sm text-red-400 mt-2">
                    Please select at least one change to discuss.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Chat interface */
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {conversation.messages
                  .filter(msg => msg.role !== 'system')
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-gray-200'
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {msg.content}
                        </div>
                        <div className={`text-xs mt-2 ${
                          msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          {formatTimestamp(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-gray-200 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-zinc-700">
                {error && (
                  <div className="mb-3 p-2 bg-red-900 bg-opacity-30 border border-red-600 rounded text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div className="flex space-x-2">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about the changes, request clarifications, or discuss alternatives..."
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-blue-500 min-h-[40px] max-h-32"
                    disabled={isLoading}
                    rows={1}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim() || isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 