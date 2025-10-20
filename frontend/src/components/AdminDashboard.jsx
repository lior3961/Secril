import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getTokens } from '../lib/auth';
import Button from './Button';
import AdminUsers from './admin/AdminUsers';
import AdminProducts from './admin/AdminProducts';
import AdminOrders from './admin/AdminOrders';
import AdminMessages from './admin/AdminMessages';
import AdminErrorLogs from './admin/AdminErrorLogs';

export default function AdminDashboard({ onClose }) {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tabs = [
    { id: 'users', label: 'משתמשים', icon: '👥' },
    { id: 'products', label: 'מוצרים', icon: '📦' },
    { id: 'orders', label: 'הזמנות', icon: '📋' },
    { id: 'messages', label: 'הודעות', icon: '💬' },
    { id: 'errorlogs', label: 'לוגי שגיאות', icon: '🔍' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <AdminUsers />;
      case 'products':
        return <AdminProducts />;
      case 'orders':
        return <AdminOrders />;
      case 'messages':
        return <AdminMessages />;
      case 'errorlogs':
        return <AdminErrorLogs />;
      default:
        return <AdminUsers />;
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h2>פאנל ניהול</h2>
        <Button className="ghost" onClick={onClose}>סגור</Button>
      </div>

      <div className="admin-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {renderTabContent()}
      </div>
    </div>
  );
}
