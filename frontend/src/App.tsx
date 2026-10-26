import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RutaProtegida, RutaPublica, RutaComerciante, RutaAdmin, RutaCliente } from './auth/Rutas';
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

import { Reviews } from './modules/merchant/Reviews';
import { Ticket } from './modules/orders/Ticket';
import { Backoffice } from './modules/admin/Backoffice';
import { AltasTab } from './modules/admin/AltasTab';
import { BajasTab } from './modules/admin/BajasTab';
import { DenunciasTab } from './modules/admin/DenunciasTab';
import { RedirectInicio } from './auth/RedirectInicio';

import { MisOfertasPage } from './ofertas/MisOfertasPage';


export default function App() {
  const { pathname } = useLocation();
  const esPanelComerciante = pathname.startsWith('/panel');

  return (
    <>
      {!esPanelComerciante && <TopBar />}
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

        <Route element={<RutaCliente />}>
          <Route path="/pedido/:codigo" element={<Ticket />} />
        </Route>

        {/* RUTAS COMERCIANTE */}
        <Route element={<RutaComerciante />}>
          <Route path="/panel" element={<Reviews />} />  {/* TEMPORAL: Reviews en /panel */}
          <Route path="/panel/reputacion" element={<Reviews />} />
        </Route>

        {/* RUTAS ADMIN · Backoffice (Pantallas 24, 25 y 26) */}
        <Route element={<RutaAdmin />}>
          <Route path="/admin" element={<Backoffice />}>
            <Route index element={<Navigate to="altas" replace />} />
            <Route path="altas" element={<AltasTab />} />
            <Route path="bajas" element={<BajasTab />} />
            <Route path="denuncias" element={<DenunciasTab />} />
            <Route path="*" element={<Navigate to="/admin/altas" replace />} />
          </Route>
        </Route>

        <Route path="/" element={<RedirectInicio />} />
        <Route path="*" element={<RedirectInicio />} />
      </Routes>
    </>
  );
}
