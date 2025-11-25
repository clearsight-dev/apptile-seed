import React from 'react';

export function ReactComponent({ model }) {
  const id = model.get('id');

  return (
    <div id={'rootElement-' + id} style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '60px',
    }}>
      <div style={{
        textAlign: 'center',
        paddingTop: '100px',
      }}>
        <p style={{ fontSize: '18px', fontWeight: '600', color: '#000000' }}>
          Leaderboard
        </p>
        <p style={{ fontSize: '14px', color: '#666666', marginTop: '8px' }}>
          Web version not fully supported
        </p>
      </div>

      {/* Powered by Tile */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '40px',
        gap: '8px',
      }}>
        <span style={{ fontSize: '14px', color: '#9ca3af' }}>Powered by Tile</span>
      </div>
    </div>
  );
}

