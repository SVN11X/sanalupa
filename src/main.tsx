import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';

// ErrorBoundary: componente que captura errores al dibujar la interfaz y muestra un mensaje en vez de una pantalla vacía.
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch(error: unknown) { console.error('Error al mostrar la página', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="error-panel" role="alert" style={{maxWidth: 640, margin: '48px auto', padding: 24}}>
        <h1>Algo falló al mostrar esta página</h1>
        <p>No es un problema de tu equipo. Puedes volver al inicio e intentarlo otra vez.</p>
        <button className="primary" type="button" onClick={() => { location.hash = '/buscar'; location.reload(); }}>Volver al inicio</button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><App/></ErrorBoundary>
  </React.StrictMode>
);
