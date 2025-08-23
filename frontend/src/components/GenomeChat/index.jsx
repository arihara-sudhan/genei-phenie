import React, { useState, useRef, useEffect } from 'react';
import './styles.css';

const GenomeChat = ({ isOpen, onClose, onActionTrigger }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Load system info when chat opens for the first time
      loadSystemInfo();
      addWelcomeMessage();
    }
  }, [isOpen]);

  const loadSystemInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/system-info');
      const data = await response.json();
      if (data.success) {
        setSystemInfo(data.system_info);
      }
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMessage = {
      id: Date.now(),
      type: 'bot',
      content: `🧬 Welcome to GenomeChat! I'm your AI assistant for the Biological GPT system. 

I can help you with:
• Finding sickle cell anemia cases
• Running DNA sequence analysis  
• Finding disease mutations
• Finding healthy genes
• Providing CRISPR suggestions
• Getting sequence information

Just tell me what you'd like to do! For example: "Find sickle cell anemia cases" or "Run analysis"`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages([welcomeMessage]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send message to agentic backend
      const response = await fetch('http://localhost:8000/api/chat-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputMessage })
      });

      const data = await response.json();
      
      if (data.success) {
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: data.message,
          timestamp: new Date().toLocaleTimeString(),
          action: data.action,
          actionType: data.action_type,
          requiresFrontendAction: data.requires_frontend_action,
          actionData: data.action_data
        };

        setMessages(prev => [...prev, botMessage]);

        // Trigger frontend action if required
        if (data.requires_frontend_action && onActionTrigger) {
          onActionTrigger({
            action: data.action,
            actionType: data.action_type,
            actionData: data.action_data,
            userMessage: inputMessage
          });
        }
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: data.message || 'Sorry, I encountered an error while processing your request. Please try again.',
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat action error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="genome-chat-overlay">
      <div className="genome-chat-container">
        <div className="chat-header">
          <div className="chat-title">
            <span className="chat-icon">🧬</span>
            <h3>GenomeChat</h3>
          </div>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.type === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                {message.content}
                {message.requiresFrontendAction && (
                  <div className="action-indicator">
                    <span className="action-badge">⚡ Action Triggered</span>
                  </div>
                )}
              </div>
              <div className="message-timestamp">
                {message.timestamp}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message bot-message">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="input-wrapper">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Try: 'Find sickle cell anemia cases' or 'Run analysis'..."
              className="chat-input"
              rows="1"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="send-button"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenomeChat;
