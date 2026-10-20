import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexto';

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
    return <Navigate to="/perfil" replace />;
  }

  return <Outlet />;
}
