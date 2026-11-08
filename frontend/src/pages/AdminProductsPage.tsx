import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  listAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../api/products';
import type { Product } from '../types';
import { BackButton, Button, Card, Divider, EmptyState, Loading, Section, TextField, useToast } from '../ui';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '8px',
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
};

export default function AdminProductsPage() {
  const { user: currentUser } = useUser();
  const showToast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
    return <EmptyState>Admin access required.</EmptyState>;
  }

  if (loading) {
    return <Loading />;
  }

  const activeProducts = products.filter((p) => p.is_active);
  const inactiveProducts = products.filter((p) => !p.is_active);

  return (
    <div>
      <BackButton />
      <Section title="Add product">
        <Card padded style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <TextField type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <TextField
            type="number"
            step="0.01"
            placeholder="Price (€)"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
          <TextField
            type="text"
            placeholder="Emoji (default: 🍺)"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={!newName || !newPrice || adding}>
            {adding ? 'Adding...' : 'Add Product'}
          </Button>
        </Card>
      </Section>

      <Section title={`Active products (${activeProducts.length})`}>
        <Card>
          {activeProducts.map((p, i) => (
            <div key={p.id}>
              {i > 0 && <Divider />}
              {editId === p.id ? (
                <div style={{ ...styles.row, flexWrap: 'wrap' }}>
                  <TextField
                    size="sm"
                    style={{ flex: '0 0 40px', textAlign: 'center' }}
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                  />
                  <TextField
                    size="sm"
                    style={{ flex: 1, minWidth: '80px' }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <TextField
                    size="sm"
                    style={{ flex: '0 0 70px' }}
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                  <Button size="xs" tone="positive" onClick={handleSaveEdit}>
                    Save
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => setEditId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div style={styles.row}>
                  <span style={styles.emoji}>{p.emoji}</span>
                  <div style={styles.info}>
                    <div style={styles.name}>{p.name}</div>
                    <div style={styles.price}>{p.price.toFixed(2)} €</div>
                  </div>
                  <Button size="xs" variant="secondary" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                  <Button size="xs" variant="secondary" tone="destructive" onClick={() => handleDelete(p)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      </Section>

      {inactiveProducts.length > 0 && (
        <Section title={`Inactive (${inactiveProducts.length})`}>
          <Card>
            {inactiveProducts.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <Divider />}
                <div style={styles.row}>
                  <span style={styles.emoji}>{p.emoji}</span>
                  <div style={styles.info}>
                    <div style={{ ...styles.name, color: 'var(--hint)' }}>{p.name}</div>
                    <div style={styles.price}>{p.price.toFixed(2)} €</div>
                  </div>
                  <Button size="xs" variant="secondary" onClick={() => handleReactivate(p)}>
                    Reactivate
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}
    </div>
  );
}
