import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Shell } from './components/Shell';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Mapa } from './screens/Mapa';
import { BuscarContato } from './screens/contatos/BuscarContato';
import { CadastroContato } from './screens/contatos/CadastroContato';
import { PerfilContato } from './screens/contatos/PerfilContato';
import { Comunicacao } from './screens/Comunicacao';

function RotaProtegida({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) return null;
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Rotas() {
  const { usuario, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <RotaProtegida>
            <Shell />
          </RotaProtegida>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/contatos" element={<BuscarContato />} />
        <Route path="/contatos/novo" element={<CadastroContato />} />
        <Route path="/contatos/:id" element={<PerfilContato />} />
        <Route path="/comunicacao" element={<Comunicacao />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  );
}
