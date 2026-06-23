export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Shopee Thailand back office. Manage products and run on-site sales.</p>
      <ul>
        <li>
          <a href="/products">Products</a> — catalog (live from the API)
        </li>
        <li>
          <a href="/products/new">Add product</a> — create a single product
        </li>
        <li>
          <a href="/import">Import</a> — bulk-load a catalog CSV (Google Sheet export)
        </li>
        <li>
          <a href="/pricing">Pricing</a> — on-site vs Shopee profit, VAT, target margin
        </li>
        <li>
          <a href="/pos">POS</a> — barcode on-site selling
        </li>
        <li>
          <a href="/stock">Stock</a> — on-hand levels and manual adjustments
        </li>
        <li>
          <a href="/sales">Sales</a> — recent sales, revenue and gross profit
        </li>
      </ul>
    </main>
  );
}
