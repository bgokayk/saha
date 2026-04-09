import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState({});
  // items: { [productId]: { product, qty } }

  function addItem(product) {
    setItems(prev => ({
      ...prev,
      [product.id]: {
        product,
        qty: (prev[product.id]?.qty || 0) + 1,
      },
    }));
  }

  function removeItem(productId) {
    setItems(prev => {
      const qty = (prev[productId]?.qty || 0) - 1;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...prev[productId], qty } };
    });
  }

  function clearCart() {
    setItems({});
  }

  const cartCount = useMemo(() => Object.values(items).reduce((a, i) => a + i.qty, 0), [items]);
  const total     = useMemo(() => Object.values(items).reduce((a, i) => a + i.product.price * i.qty, 0), [items]);
  const cartList  = useMemo(() => Object.values(items).filter(i => i.qty > 0), [items]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, cartCount, total, cartList }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
