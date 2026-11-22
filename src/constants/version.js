import React from 'react';

export default function AppVersion() {
  return React.createElement('span', null, `v${import.meta.env.VITE_APP_VERSION}`);
}
