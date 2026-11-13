import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {RedirectInicio} from "./auth/RedirectInicio";
import { RutaProtegida, RutaPublica, RutaComerciante, RutaAdmin, RutaCliente } from './auth/Rutas';
import { DetalleOfertaPage } from './comercios/DetalleOfertaPage';
import { HorariosComercioPage } from './comercios/HorariosComercioPage';
import { PerfilComercioPage } from './comercios/PerfilComercioPage';
import { CanastaPage } from './comercios/CanastaPage';
import { ListaCanastasPage } from './comercios/ListaCanastasPage';
import { RegistroComercioPage } from './comercios/RegistroComercioPage';
import { TiendaPublicaPage } from './comercios/TiendaPublicaPage';
import { ExplorarPage } from './comercios/ExplorarPage';
import { InicioClientePage } from './comercios/InicioClientePage';
import { TopBar } from './components/TopBar';
import { AltasTab } from './modules/admin/AltasTab';
import { Backoffice } from './modules/admin/Backoffice';
import { BajasTab } from './modules/admin/BajasTab';
import { DenunciasTab } from './modules/admin/DenunciasTab';
import { Reviews } from './modules/merchant/Reviews';
import { Ticket } from './modules/orders/Ticket';
import { ComercioEstadoPage } from './pages/ComercioEstadoPage';
import { EnConstruccion } from './pages/EnConstruccion';
import { Login } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { Recuperar } from './pages/Recuperar';
import { Registro } from './pages/Registro';
import { Restablecer } from './pages/Restablecer';
import { VerificarCorreo } from './pages/VerificarCorreo';
import { NuevaOfertaPage } from './ofertas/NewOfertaPage';
import { PanelComerciante } from './modules/merchant/PanelComerciante';
import { PedidosPanel } from './modules/merchant/PedidosPanel';
import { ResumenPanel } from './modules/merchant/ResumenPanel';

import { MisOfertasPage } from './ofertas/MisOfertasPage';

export default function App() {
  const { pathname } = useLocation();
  const esPanelComerciante = pathname.startsWith('/panel');
  const esInicioCliente = pathname === '/inicio';
  const esExploracionCliente = pathname === '/buscar';

  return (
    <>
      {!esPanelComerciante && !esInicioCliente && !esExploracionCliente && <TopBar />}

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
          <Route path="/comercio/estado" element={<ComercioEstadoPage />} />
          <Route path="/ofertas/nueva" element={<NuevaOfertaPage />} />
          <Route path="/comercios/registro" element={<RegistroComercioPage />} />
          <Route
            path="/comercios/perfil"
            element={<Navigate to="/panel/mi-local" replace />}
          />
          <Route
            path="/comercios/horarios"
            element={<Navigate to="/panel/horarios" replace />}
          />
          <Route
            path="/ofertas/mias"
            element={<Navigate to="/panel/productos" replace />}
          />
        </Route>

        <Route element={<RutaCliente />}>
          <Route path="/inicio" element={<InicioClientePage />} />

          <Route
            path="/comercios/:comercioId/productos/:productoId"
            element={<DetalleOfertaPage />}
          />

          <Route
            path="/canastas"
            element={<ListaCanastasPage />}
          />

          <Route
            path="/canastas/:comercioId"
            element={<CanastaPage />}
          />

          <Route path="/pedido/:codigo" element={<Ticket />} />
          <Route
            path="/mis-pedidos"
            element={
              <EnConstruccion
                titulo="Mis pedidos"
                descripcion="Acá vas a poder seguir el estado de tus pedidos y acceder a tus tickets."
              />
            }
          />
         
          <Route path="/buscar" element={<ExplorarPage />} />
        </Route>

        {/* RUTAS COMERCIANTE */}
        <Route element={<RutaComerciante />}>
          <Route path="/panel" element={<PanelComerciante />}>
            <Route index element={<ResumenPanel />} />
            <Route path="resumen" element={<ResumenPanel />} />
            <Route path="pedidos" element={<PedidosPanel />} />
            <Route path="productos" element={<MisOfertasPage />} />
            <Route path="mi-local" element={<PerfilComercioPage />} />
            <Route path="horarios" element={<HorariosComercioPage />} />
            <Route path="reputacion" element={<Reviews />} />
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
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

        {/* RUTAS POR DEFECTO */}
        <Route path="/" element={<RedirectInicio />} />
        <Route path="*" element={<RedirectInicio />} />
      </Routes>
    </>
  );
}
