import { Outlet } from 'react-router-dom';
import { MerchantHeader } from '../../components/layout/MerchantHeader';

export function PanelComerciante() {
  return (
    <>
      <MerchantHeader />
      <Outlet />
    </>
  );
}
