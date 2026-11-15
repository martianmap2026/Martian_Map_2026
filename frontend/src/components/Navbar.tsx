import './Navbar.css'

interface NavbarProps {
  currentTab: 'home' | 'region' | 'investigation';
  setCurrentTab: (tab: 'home' | 'region' | 'investigation') => void;
}

export function Navbar({ currentTab, setCurrentTab }: NavbarProps) {
  return (
    <nav className="mars-navbar">
      <div 
        className="nav-brand" 
        onClick={() => setCurrentTab('home')} 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <img 
          src="/LogoTitulo.png" 
          alt="Mars Map Logo" 
          style={{ height: '36px', objectFit: 'contain' }} 
        />
      </div>
      
      <div className="nav-links">
        <button 
          className={`nav-btn ${currentTab === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentTab('home')}
        >
           Home
        </button>
        <button 
          className={`nav-btn ${currentTab === 'region' ? 'active' : ''}`}
          onClick={() => setCurrentTab('region')}
        >
          Region Mode
        </button>
        <button 
          className={`nav-btn ${currentTab === 'investigation' ? 'active' : ''}`}
          onClick={() => setCurrentTab('investigation')}
        >
          Investigation Mode
        </button>
      </div>
    </nav>
  )
}