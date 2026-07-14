import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { QK } from '../../hooks/useApi';
import { SalesService, MasterDataService, InventoryService } from '../../services/api-services';

export default function SalesRedirect() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Prefetch by fetching then caching to avoid TS overloads on prefetchQuery
    Promise.all([
      SalesService.getSalesTransactions().then((d) => qc.setQueryData(QK.SALES_TRANSACTIONS as any, d)),
      MasterDataService.getProducts().then((d) => qc.setQueryData(QK.PRODUCTS as any, d)),
      SalesService.getCustomers().then((d) => qc.setQueryData(['sales-customers'], d)),
      MasterDataService.getBrands().then((d) => qc.setQueryData(QK.BRANDS as any, d)),
      InventoryService.getProductionStock().then((d) => qc.setQueryData(QK.PRODUCTION_STOCK as any, d)),
    ])
      .catch((e) => console.error('[SalesRedirect] Prefetch failed', e))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  return <Navigate to="/sales" replace />;
}
