import React, { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://diaasjjzbtgogqlnondp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYWFzamp6YnRnb2dxbG5vbmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTk4MjMsImV4cCI6MjA3NjE5NTgyM30.Ehb4bUtkteo_7If7znjoURGlVO8EjBozB7Kh2UMIzCI';

export function ReactComponent({ model }) {
  const [userPotholes, setUserPotholes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Web version - simplified
    setLoading(false);
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f8f7f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <h1 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: 0,
          color: '#231c0f',
        }}>
          My Reports
        </h1>
      </div>

      {/* Content */}
      <div style={{
        padding: '16px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center',
            paddingTop: '100px',
          }}>
            <p>Loading your reports...</p>
          </div>
        ) : userPotholes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            paddingTop: '100px',
          }}>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#231c0f' }}>
              No reports yet
            </p>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
              Start reporting potholes to see them here
            </p>
          </div>
        ) : (
          userPotholes.map((pothole, index) => (
            <div
              key={pothole.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#231c0f' }}>
                  #{index + 1} {pothole.address?.split(',')[0] || 'Unknown Location'}
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Date: {formatDate(pothole.created_at)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <img
                  src={pothole.image_url}
                  alt="Pothole"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    backgroundColor: '#e5e7eb',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#231c0f',
                    margin: '0 0 4px 0',
                  }}>
                    Address:
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    margin: 0,
                    lineHeight: '18px',
                  }}>
                    {pothole.address || 'No address provided'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Powered by Tile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '40px',
          marginBottom: '20px',
          gap: '8px',
        }}>
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>Powered by Tile</span>
        </div>
      </div>
    </div>
  );
}

export const WidgetConfig = {
  primaryColor: '',
  appTitle: '',
};

export const WidgetEditors = [];

export const PropertySettings = [];

