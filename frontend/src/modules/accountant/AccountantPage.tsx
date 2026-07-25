import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProducts, useRawMaterials, useStock, useSalesTransactions, useBrands, useProductionStock, useCustomers } from '../../hooks/useApi';
import { Loader2, Package, Database, ShoppingBag, TrendingUp, Box, FileText } from 'lucide-react';

export default function AccountantPage() {
  const productsQuery = useProducts();
  const rawMaterialsQuery = useRawMaterials();
  const stockQuery = useStock();
  const salesQuery = useSalesTransactions();
  const brandsQuery = useBrands();
  const productionStockQuery = useProductionStock();
  const customersQuery = useCustomers();

  useEffect(() => {
    // Trigger refetches so the accountant portal has freshest data immediately
    void productsQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch products failed', e));
    void salesQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch sales transactions failed', e));
    void brandsQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch brands failed', e));
    void productionStockQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch production stock failed', e));
    void customersQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch customers failed', e));
    void rawMaterialsQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch raw materials failed', e));
    void stockQuery.refetch().catch((e) => console.error('[AccountantPage] Refetch stock failed', e));
  }, []);

  const loading = [productsQuery, rawMaterialsQuery, stockQuery, salesQuery].some(q => q.isLoading);

  const products = Array.isArray(productsQuery.data) ? productsQuery.data : [];
  const rawMaterials = Array.isArray(rawMaterialsQuery.data) ? rawMaterialsQuery.data : [];
  const stockItems = Array.isArray(stockQuery.data) ? stockQuery.data : [];
  const salesOrders = salesQuery.data && Array.isArray(salesQuery.data.items)
    ? salesQuery.data.items
    : (Array.isArray(salesQuery.data) ? salesQuery.data : []);

  const summary = useMemo(() => ({
    products: products.length,
    rawMaterials: rawMaterials.length,
    stockItems: stockItems.length,
    salesOrders: salesOrders.length,
  }), [products, rawMaterials, stockItems, salesOrders]);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Accountant Dashboard</p>
            <h1 className="mt-4 text-4xl font-extrabold text-slate-950">Sales, Products, & Customer Monitoring</h1>
            <p className="mt-3 text-base text-slate-600 leading-7">Access sales analytics and product visibility from a single financial workspace.</p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-[2rem] bg-slate-900 p-6 text-white shadow-2xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Current Focus</p>
              <p className="mt-2 text-3xl font-black">Financial Controls</p>
            </div>
            <div className="rounded-[1.75rem] bg-slate-700 p-4">
              <ShoppingBag className="w-10 h-10" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Recent Dispatches & Returns</h2>
          <p className="text-sm text-slate-500">Latest sales ledger entries</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 uppercase tracking-widest text-xs">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.length > 0 ? (
                salesOrders.slice(0, 6).map((tx: any) => (
                  <tr key={tx.id} className="border-t border-slate-100">
                    <td className="py-3 px-4">{new Date(tx.salesDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-black">{tx.brandName}</td>
                    <td className="py-3 px-4">{tx.productName}</td>
                    <td className="py-3 px-4">{tx.type === 'SALES_DISPATCH' ? 'Dispatch' : tx.type}</td>
                    <td className="py-3 px-4 text-right font-bold">{tx.quantity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">No recent dispatches found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-800">
            <Package className="w-5 h-5" />
            <p className="font-semibold uppercase tracking-[0.25em] text-slate-500">Products</p>
          </div>
          <p className="mt-6 text-5xl font-extrabold text-slate-950">{summary.products}</p>
          <p className="mt-2 text-sm text-slate-500">Master product records available for sales.</p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-800">
            <Database className="w-5 h-5" />
            <p className="font-semibold uppercase tracking-[0.25em] text-slate-500">Raw Materials</p>
          </div>
          <p className="mt-6 text-5xl font-extrabold text-slate-950">{summary.rawMaterials}</p>
          <p className="mt-2 text-sm text-slate-500">Inventory records used in costing and procurement.</p>
        </div>


        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-800">
            <TrendingUp className="w-5 h-5" />
            <p className="font-semibold uppercase tracking-[0.25em] text-slate-500">Sales Orders</p>
          </div>
          <p className="mt-6 text-5xl font-extrabold text-slate-950">{summary.salesOrders}</p>
          <p className="mt-2 text-sm text-slate-500">Transactions created in the sales ledger.</p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-800">
            <Box className="w-5 h-5" />
            <p className="font-semibold uppercase tracking-[0.25em] text-slate-500">Stock Items</p>
          </div>
          <p className="mt-6 text-5xl font-extrabold text-slate-950">{summary.stockItems}</p>
          <p className="mt-2 text-sm text-slate-500">Tracked inventory stock records.</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Quick Actions</h2>
            <p className="mt-2 text-sm text-slate-500">Jump directly into sales, products, raw materials, or customers.</p>
          </div>
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            to="/accountant/sales"
            className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-indigo-500 hover:bg-white hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Sales</p>
                <p className="mt-4 text-2xl font-extrabold text-slate-950">Open Sales</p>
              </div>
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="mt-4 text-sm text-slate-500">Manage sales invoices, dispatch, and payment records.</p>
          </Link>

          <Link
            to="/accountant/products"
            className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-indigo-500 hover:bg-white hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Products</p>
                <p className="mt-4 text-2xl font-extrabold text-slate-950">Product Catalog</p>
              </div>
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="mt-4 text-sm text-slate-500">Review and update product master data for sales.</p>
          </Link>

        </div>
      </section>
    </div>
  );
}
