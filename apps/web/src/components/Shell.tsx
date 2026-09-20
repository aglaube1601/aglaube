import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const TABS = [
  { to: '/', label: 'Painel', icon: '📊', end: true },
  { to: '/mapa', label: 'Mapa', icon: '🗺️' },
  { to: '/contatos', label: 'Contatos', icon: '👤' },
  { to: '/comunicacao', label: 'Mensagens', icon: '💬' },
];

export function Shell() {
  const { usuario, municipio, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1>{municipio?.nome ?? 'AGLAUBE'}</h1>
          <span style={{ fontSize: 10.5, opacity: 0.7 }}>
            {usuario?.nome} · {usuario?.perfil}
          </span>
        </div>
        <button onClick={logout}>Sair</button>
      </div>

      <div className="screen">
        <Outlet />
      </div>

      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
