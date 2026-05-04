import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const WEAPON_KART_INVENTORY_KEY = 'weaponKartInventoryV1';

export default function WeaponKartInventory() {
  const payload = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem(WEAPON_KART_INVENTORY_KEY) || '{}');
    } catch {
      return {};
    }
  }, []);

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const selectedId = payload?.selectedId || null;

  return (
    <div style={{ minHeight: '100vh', background: '#091325', color: '#fff', fontFamily: 'system-ui', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Weapon Kart Inventory</h1>
        <Link to="/games/weaponkart" style={{ color: '#ffd166', fontWeight: 800 }}>Back to game</Link>
      </div>
      {items.length === 0 ? (
        <div style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,.06)' }}>
          No items yet. Collect or purchase items first.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: selectedId === item.id ? '1px solid #ffd166' : '1px solid rgba(255,255,255,.2)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,.06)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{item.icon || item.name?.slice(0,2)?.toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Ammo {item.ammo}</div>
              </div>
              {selectedId === item.id && <div style={{ fontSize: 12, color: '#ffd166', fontWeight: 900 }}>Selected</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
