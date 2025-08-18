import Button from './Button';

export default function CartDrawer({ open, onClose, items = [] }) {
  return (
    <aside className={`cart-drawer ${open ? 'open' : ''}`} role="dialog" aria-label="סל הקניות">
      <div className="cart-header">
        <strong>סל הקניות</strong>
        <Button className="ghost" onClick={onClose}>סגור</Button>
      </div>
      <div className="cart-items">
        {items.length === 0 ? (
          <p>העגלה ריקה כרגע.</p>
        ) : (
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {items.map((it) => <li key={it.id}>{it.title} — {it.price}₪</li>)}
          </ul>
        )}
      </div>
      <Button className="primary" onClick={() => alert('לתשלום (דמו)')}>לתשלום</Button>
    </aside>
  );
}
