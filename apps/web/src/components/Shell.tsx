import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, type PerfilUsuario } from '../lib/auth';

// Espelha o RBAC de cada controller no backend — evita mostrar uma aba
// que só vai devolver 403 pro perfil logado (ver *.controller.ts @Roles).
const TABS: Array<{ to: string; label: string; icon: string; end?: boolean; perfis?: PerfilUsuario[] }> = [
  { to: '/', label: 'Painel', icon: '📊', end: true },
  { to: '/mapa', label: 'Mapa', icon: '🗺️', perfis: ['administrador', 'coordenador', 'visualizacao'] },
  { to: '/contatos', label: 'Contatos', icon: '👤' },
  { to: '/comunicacao', label: 'Mensagens', icon: '💬', perfis: ['administrador', 'coordenador', 'operador'] },
  { to: '/eleitoral', label: 'Eleitoral', icon: '🗳️', perfis: ['administrador', 'coordenador', 'visualizacao'] },
  { to: '/auditoria', label: 'Auditoria', icon: '🛡️', perfis: ['administrador'] },
];

export function Shell() {
  const { usuario, municipio, logout } = useAuth();
  const tabsVisiveis = TABS.filter((tab) => !tab.perfis || (usuario && tab.perfis.includes(usuario.perfil)));

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
        {tabsVisiveis.map((tab) => (
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
