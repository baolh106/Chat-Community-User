import { AdminPage } from './components/AdminPage';

function App() {
  return (
    <div className="page-shell">
      <section 
        className="chat-card" 
        style={{ 
          width: '95vw',
          maxWidth: '1200px',
          margin: 'auto'
        }}
      >
        <AdminPage />
      </section>
    </div>
  );
}

export default App;
