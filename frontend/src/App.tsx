import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida, RutaPublica } from './auth/Rutas';
import { TopBar } from './components/TopBar';
import { Login } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { Recuperar } from './pages/Recuperar';
import { Registro } from './pages/Registro';
import { Restablecer } from './pages/Restablecer';
import { VerificarCorreo } from './pages/VerificarCorreo';
import { NuevaOfertaPage } from './ofertas/NewOfertaPage';

export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route element={<RutaPublica />}>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/restablecer" element={<Restablecer />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/verificar-correo" element={<VerificarCorreo />} />
        </Route>

        <Route element={<RutaProtegida />}>
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/ofertas/nueva" element={<NuevaOfertaPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/perfil" replace />} />
        <Route path="*" element={<Navigate to="/perfil" replace />} />
      </Routes>
    </>
  );
}
