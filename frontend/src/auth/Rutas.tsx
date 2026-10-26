import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexto';
import { rutaInicio } from './rutaInicio';

export function RutaProtegida() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RutaPublica() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  if (usuario) {
  return <Navigate to={rutaInicio(usuario.rol)} replace />;
  }

  return <Outlet />;
}

export function RutaComerciante() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  if (!usuario || usuario.rol !== 'COMERCIANTE') {
    return <Navigate to="/perfil" replace />;
  }

  if (usuario.estado !== 'HABILITADO') {
    return <Navigate to="/perfil" replace />;
  }

  return <Outlet />;
}

export function RutaAdmin() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  if (!usuario || usuario.rol !== 'ADMINISTRADOR') {
    return <Navigate to="/perfil" replace />;
  }

  return <Outlet />;
}

// NUEVA: Solo CLIENTE (Pantalla 22)
export function RutaCliente() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  if (!usuario || usuario.rol !== 'CLIENTE') {
    return <Navigate to="/perfil" replace />;
  }

  return <Outlet />;
}
