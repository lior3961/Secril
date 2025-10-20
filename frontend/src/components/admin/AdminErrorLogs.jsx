import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const AdminErrorLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Filters
  const [level, setLevel] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState(50);

  // Fetch error logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: '0'
      });
      
      if (level !== 'all') params.append('level', level);
      if (searchTerm) params.append('searchTerm', searchTerm);
      
      const response = await fetch(`/api/admin/error-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const data = await response.json();
      setLogs(data.logs || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/admin/error-logs/stats/summary?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Cleanup old logs
  const handleCleanup = async (daysToKeep) => {
    if (!confirm(`Delete logs older than ${daysToKeep} days?`)) return;
    
    try {
      const response = await fetch('/api/admin/error-logs/cleanup', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days: daysToKeep })
      });
      
      if (!response.ok) throw new Error('Failed to cleanup logs');
      
      const data = await response.json();
      alert(`Successfully deleted ${data.deletedCount} old logs`);
      fetchLogs();
      fetchStats();
    } catch (err) {
      alert('Cleanup failed: ' + err.message);
    }
  };

  // View log details
  const viewLogDetails = async (logId) => {
    try {
      const response = await fetch(`/api/admin/error-logs/${logId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch log details');
      
      const data = await response.json();
      setSelectedLog(data.log);
    } catch (err) {
      alert('Failed to fetch log details: ' + err.message);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLogs();
      fetchStats();
    }
  }, [token, level, days, limit]);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get level badge color
  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800';
      case 'warn': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">יומני שגיאות</h1>
        <p className="text-gray-600">צפייה וניתוח שגיאות במערכת</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">סה"כ</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <div className="text-sm text-red-600">שגיאות</div>
            <div className="text-2xl font-bold text-red-700">{stats.levelCounts.error}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <div className="text-sm text-yellow-600">אזהרות</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.levelCounts.warn}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <div className="text-sm text-blue-600">מידע</div>
            <div className="text-2xl font-bold text-blue-700">{stats.levelCounts.info}</div>
          </div>
        </div>
      )}

      {/* Top Error Paths */}
      {stats && stats.topErrorPaths && stats.topErrorPaths.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">נתיבים עם הכי הרבה שגיאות</h2>
          <div className="space-y-2">
            {stats.topErrorPaths.map((path, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="font-mono text-sm">{path.path}</span>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                  {path.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">רמה</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="all">הכל</option>
              <option value="error">שגיאות</option>
              <option value="warn">אזהרות</option>
              <option value="info">מידע</option>
            </select>
          </div>

          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">חיפוש</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש בהודעות שגיאה..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Days Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">תקופה</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="1">יום אחרון</option>
              <option value="7">7 ימים</option>
              <option value="30">30 ימים</option>
              <option value="90">90 ימים</option>
            </select>
          </div>

          {/* Limit */}
          <div>
            <label className="block text-sm font-medium mb-1">תוצאות</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={fetchLogs}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            רענן
          </button>
          <button
            onClick={() => handleCleanup(30)}
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
          >
            נקה לוגים ישנים (30+ ימים)
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <strong>שגיאה:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">טוען לוגים...</p>
        </div>
      )}

      {/* Logs Table */}
      {!loading && logs.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    זמן
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    רמה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    הודעה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    נתיב
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    משתמש
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                      {log.message}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {log.request_path || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.user_id ? log.user_id.substring(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => viewLogDetails(log.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        פרטים
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Logs */}
      {!loading && logs.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">לא נמצאו לוגים</p>
          <p className="text-gray-400 text-sm mt-2">נסה לשנות את הפילטרים או להריץ פעולה שתיצור שגיאה</p>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">פרטי שגיאה</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <div className="font-semibold text-gray-700">זמן:</div>
                  <div>{formatDate(selectedLog.created_at)}</div>
                </div>

                <div>
                  <div className="font-semibold text-gray-700">רמה:</div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${getLevelColor(selectedLog.level)}`}>
                    {selectedLog.level}
                  </span>
                </div>

                <div>
                  <div className="font-semibold text-gray-700">הודעה:</div>
                  <div className="bg-gray-50 p-3 rounded">{selectedLog.message}</div>
                </div>

                {/* Request Info */}
                {selectedLog.request_path && (
                  <div>
                    <div className="font-semibold text-gray-700">נתיב בקשה:</div>
                    <div className="font-mono text-sm">{selectedLog.request_method} {selectedLog.request_path}</div>
                  </div>
                )}

                {selectedLog.user_id && (
                  <div>
                    <div className="font-semibold text-gray-700">משתמש:</div>
                    <div className="font-mono text-sm">{selectedLog.user_id}</div>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div>
                    <div className="font-semibold text-gray-700">IP:</div>
                    <div className="font-mono text-sm">{selectedLog.ip_address}</div>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div>
                    <div className="font-semibold text-gray-700">User Agent:</div>
                    <div className="text-sm break-all">{selectedLog.user_agent}</div>
                  </div>
                )}

                {/* Error Details */}
                {selectedLog.error_details && (
                  <div>
                    <div className="font-semibold text-gray-700">פרטי שגיאה:</div>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.error_details, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Stack Trace */}
                {selectedLog.stack_trace && (
                  <div>
                    <div className="font-semibold text-gray-700">Stack Trace:</div>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
                      {selectedLog.stack_trace}
                    </pre>
                  </div>
                )}

                {/* Additional Context */}
                {selectedLog.additional_context && (
                  <div>
                    <div className="font-semibold text-gray-700">הקשר נוסף:</div>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.additional_context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminErrorLogs;

