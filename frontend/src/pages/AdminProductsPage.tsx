import { useEffect, useState } from 'react';
import { useUser } from '../App';
import {
  listAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../api/products';
import type { Product } from '../types';
import { useNavigate } from 'react-router-dom';

const styles = {
  section: {
    padding: '0 16px 16px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    padding: '16px 0 8px',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '8px',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '16px',
  },
  emoji: {
    fontSize: '24px',
    width: '32px',
    textAlign: 'center' as const,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '15px',
    fontWeight: 500,
  },
  price: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  actionBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
  dangerBtn: {
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--destructive)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '16px',
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
  },
  input: {
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
    outline: 'none',
  },
  submitBtn: {
    padding: '12px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '20px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
  toast: {
    position: 'fixed' as const,
    bottom: '84px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    zIndex: 300,
    whiteSpace: 'nowrap' as const,
  },
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 16px',
    marginBottom: '8px',
  },
};

export default function AdminProductsPage() {
  const { user: currentUser } = useUser();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Add product form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  const fetchProducts = async () => {
    try {
      const p = await listAllProducts();
      setProducts(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAdd = async () => {
    if (!newName || !newPrice) return;
    setAdding(true);
    try {
      await createProduct({
        name: newName,
        price: parseFloat(newPrice),
        emoji: newEmoji || undefined,
      });
      setNewName('');
      setNewPrice('');
      setNewEmoji('');
      showToast('Product added');
      fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add product');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setEditName(p.name);
    setEditPrice(p.price.toString());
    setEditEmoji(p.emoji);
  };

  const handleSaveEdit = async () => {
    if (editId === null) return;
    try {
      await updateProduct(editId, {
        name: editName,
        price: parseFloat(editPrice),
        emoji: editEmoji,
      });
      setEditId(null);
      showToast('Product updated');
      fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleDelete = async (p: Product) => {
    try {
      await deleteProduct(p.id);
      showToast(`${p.name} deactivated`);
      fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleReactivate = async (p: Product) => {
    try {
      await updateProduct(p.id, { is_active: true });
      showToast(`${p.name} reactivated`);
      fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (!currentUser?.is_admin) {
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const activeProducts = products.filter((p) => p.is_active);
  const inactiveProducts = products.filter((p) => !p.is_active);

  return (
    <div>
      <button style={styles.backBtn} onClick={() => navigate('/admin')}>
        ← Back to Admin
      </button>
      <div style={styles.section}>
        <div style={styles.header}>Add product</div>
        <div style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            style={styles.input}
            type="number"
            step="0.01"
            placeholder="Price (€)"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <input
            style={styles.input}
            type="text"
            placeholder="Emoji (default: 🍺)"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
          />
          <button
            style={{
              ...styles.submitBtn,
              opacity: !newName || !newPrice || adding ? 0.6 : 1,
            }}
            onClick={handleAdd}
            disabled={!newName || !newPrice || adding}
          >
            {adding ? 'Adding...' : 'Add Product'}
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.header}>Active products ({activeProducts.length})</div>
        <div style={styles.card}>
          {activeProducts.map((p, i) => (
            <div key={p.id}>
              {i > 0 && <div style={styles.separator} />}
              {editId === p.id ? (
                <div style={{ ...styles.row, flexWrap: 'wrap' as const, gap: '8px' }}>
                  <input
                    style={{ ...styles.input, flex: '0 0 40px', padding: '8px', textAlign: 'center' as const }}
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                  />
                  <input
                    style={{ ...styles.input, flex: 1, padding: '8px', minWidth: '80px' }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <input
                    style={{ ...styles.input, flex: '0 0 70px', padding: '8px' }}
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                  <button style={{ ...styles.actionBtn, backgroundColor: '#4caf50', color: '#fff' }} onClick={handleSaveEdit}>
                    Save
                  </button>
                  <button style={styles.actionBtn} onClick={() => setEditId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={styles.row}>
                  <span style={styles.emoji}>{p.emoji}</span>
                  <div style={styles.info}>
                    <div style={styles.name}>{p.name}</div>
                    <div style={styles.price}>{p.price.toFixed(2)} €</div>
                  </div>
                  <button style={styles.actionBtn} onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button style={{ ...styles.actionBtn, ...styles.dangerBtn }} onClick={() => handleDelete(p)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {inactiveProducts.length > 0 && (
        <div style={styles.section}>
          <div style={styles.header}>Inactive ({inactiveProducts.length})</div>
          <div style={styles.card}>
            {inactiveProducts.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <div style={styles.separator} />}
                <div style={styles.row}>
                  <span style={styles.emoji}>{p.emoji}</span>
                  <div style={styles.info}>
                    <div style={{ ...styles.name, color: 'var(--hint)' }}>{p.name}</div>
                    <div style={styles.price}>{p.price.toFixed(2)} €</div>
                  </div>
                  <button style={styles.actionBtn} onClick={() => handleReactivate(p)}>
                    Reactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
