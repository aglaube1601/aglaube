import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';

export type PerfilUsuario = 'administrador' | 'coordenador' | 'operador' | 'visualizacao';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  permissaoEngajamentoPolitico: boolean;
  municipioId: string | null;
}

interface Municipio {
  id: string;
  nome: string;
  uf: string;
}

interface AuthState {
  usuario: Usuario | null;
  municipio: Municipio | null;
  loading: boolean;
  erro: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'aglaube.token';
const USER_KEY = 'aglaube.usuario';
const MUNICIPIO_KEY = 'aglaube.municipio';

async function resolverMunicipio(usuario: Usuario): Promise<Municipio> {
  if (usuario.municipioId) {
    const municipios = await api.get<Municipio[]>('/municipios');
    const encontrado = municipios.find((m) => m.id === usuario.municipioId);
    if (encontrado) return encontrado;
  }
  // Perfil sem município vinculado (ex.: admin de bootstrap) — MVP é de
  // município único, então cai no primeiro cadastrado.
  const municipios = await api.get<Municipio[]>('/municipios');
  if (municipios.length === 0) {
    throw new Error('Nenhum município cadastrado — rode "pnpm seed" na API.');
  }
  return municipios[0];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [municipio, setMunicipio] = useState<Municipio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedMunicipio = localStorage.getItem(MUNICIPIO_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedUser && storedMunicipio && storedToken) {
      setUsuario(JSON.parse(storedUser));
      setMunicipio(JSON.parse(storedMunicipio));
    }
    setLoading(false);
  }, []);

  async function login(email: string, senha: string) {
    setErro(null);
    try {
      const resposta = await api.post<{ accessToken: string; usuario: Usuario }>(
        '/auth/login',
        { email, senha },
      );
      localStorage.setItem(TOKEN_KEY, resposta.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(resposta.usuario));

      const municipioResolvido = await resolverMunicipio(resposta.usuario);
      localStorage.setItem(MUNICIPIO_KEY, JSON.stringify(municipioResolvido));

      setUsuario(resposta.usuario);
      setMunicipio(municipioResolvido);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Não foi possível conectar à API.';
      setErro(msg);
      throw e;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MUNICIPIO_KEY);
    setUsuario(null);
    setMunicipio(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, municipio, loading, erro, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
