import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider afterSignOutUrl="/" appearance={{ variables: { colorPrimary: '#FF5A0F', colorForeground: '#12161F' } }}>
      <App />
    </ClerkProvider>
  </StrictMode>
);