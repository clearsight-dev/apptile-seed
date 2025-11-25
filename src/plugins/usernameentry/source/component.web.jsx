import React from 'react';

export function ReactComponent({ model }) {
  const id = model.get('id');

  return (
    <div id={'rootElement-' + id}>
      <p>Username Entry - Web version not supported</p>
    </div>
  );
}

