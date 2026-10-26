import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida, RutaPublica } from './auth/Rutas';
import { HorariosComercioPage } from './comercios/HorariosComercioPage';
import { PerfilComercioPage } from './comercios/PerfilComercioPage';
import { RegistroComercioPage } from './comercios/RegistroComercioPage';
import { TiendaPublicaPage } from './comercios/TiendaPublicaPage';
import { TopBar } from './components/TopBar';
import { Login } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { Recuperar } from './pages/Recuperar';
import { Registro } from './pages/Registro';
import { Restablecer } from './pages/Restablecer';
import { VerificarCorreo } from './pages/VerificarCorreo';
import { NuevaOfertaPage } from './ofertas/NewOfertaPage';
import { MisOfertasPage } from './ofertas/MisOfertasPage';

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

        <Route path="/comercios/:id" element={<TiendaPublicaPage />} />

        <Route element={<RutaProtegida />}>
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/ofertas/nueva" element={<NuevaOfertaPage />} />
          <Route path="/comercios/registro" element={<RegistroComercioPage />} />
          <Route path="/comercios/perfil" element={<PerfilComercioPage />} />
          <Route path="/comercios/horarios" element={<HorariosComercioPage />} />
          <Route path="/ofertas/mias" element={<MisOfertasPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/perfil" replace />} />
        <Route path="*" element={<Navigate to="/perfil" replace />} />
      </Routes>
    </>
  );
}
