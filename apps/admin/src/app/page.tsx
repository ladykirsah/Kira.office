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
          <a href="/pos">POS</a> — barcode on-site selling
        </li>
      </ul>
    </main>
  );
}
