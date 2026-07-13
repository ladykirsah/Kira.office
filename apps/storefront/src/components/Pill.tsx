/**
 * Shared rounded status/label pill — the single source of the pill shape (font, padding, radius) so
 * every pill in the storefront reads as one design. Callers pass only the colors: BrandTag uses a
 * gray fill, ReadyToShip a green fill, etc.
 */
export function Pill({
  children,
  color,
  background,
}: {
  children: React.ReactNode;
  color: string;
  background: string;
}) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 400,
        color,
        background,
        padding: "2px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
