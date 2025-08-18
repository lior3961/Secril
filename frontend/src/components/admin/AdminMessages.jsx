import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getTokens } from '../../lib/auth';

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ממתין'); // Default to pending messages

  useEffect(() => {
    fetchMessages();
  }, [statusFilter]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { access } = getTokens();
      const data = await api(`/api/admin/messages?status=${statusFilter}`, { token: access });
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (messageId, newStatus) => {
    try {
      const { access } = getTokens();
      await api(`/api/admin/messages/${messageId}/status`, {
        method: 'PATCH',
        token: access,
        body: { status: newStatus }
      });
      // Refresh messages after status update
      fetchMessages();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="admin-messages">
      <div className="messages-header">
        <h3>הודעות צור קשר ({messages.length})</h3>
        <div className="status-filter">
          <button 
            className={`filter-btn ${statusFilter === 'ממתין' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ממתין')}
          >
            ממתין לטיפול
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'טופל' ? 'active' : ''}`}
            onClick={() => setStatusFilter('טופל')}
          >
            טופל
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            הכל
          </button>
        </div>
      </div>

      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>אין הודעות חדשות</p>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className="message-card">
              <div className="message-header">
                <div className="message-info">
                  <h4>{message.name}</h4>
                  <p className="message-email">{message.email}</p>
                  <p className="message-date">{formatDate(message.created_at)}</p>
                  <span className={`status-badge ${message.status === 'טופל' ? 'handled' : 'pending'}`}>
                    {message.status || 'ממתין'}
                  </span>
                </div>
                {message.status !== 'טופל' && (
                  <button 
                    className="mark-handled-btn"
                    onClick={() => updateMessageStatus(message.id, 'טופל')}
                  >
                    סמן כטופל
                  </button>
                )}
              </div>

              <div className="message-content">
                <p>{message.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
