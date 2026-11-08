import { createContext, useContext, useEffect, useState } from 'react';

import { MAX_CART_LINES } from '../features/cart/constants';
import { useCartLines } from '../features/cart/hooks/useCartLines';
import {
  clampQuantity,
  countUnits,
  purchasableSelected,
  subtotalMinor as sumSubtotalMinor,
} from '../features/cart/lib/cartMath';
import { loadCart, saveCart } from '../features/cart/lib/cartStorage';
import { lineKey } from '../features/cart/lib/lineKey';

const CartContext = createContext();

/**
 * The cart. What is stored in the browser is only what the customer chose (product id, size,
 * colour, quantity, ticked or not). Titles, images, prices and stock are always read fresh
 * from the database, and all money is whole cents.
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { lines, productsById, isLoading, isError, refetch } = useCartLines(items);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  /**
   * @param {{ id?: string, _id?: string, stock?: number, priceMinor?: number,
   *   sizes?: string[], colors?: { name: string }[] }} product
   * @param {number} [quantity]
   * @param {{ size?: string, color?: string }} [options] defaults to the first size/colour
   */
  const addToCart = (product, quantity = 1, options = {}) => {
    const productId = product.id ?? product._id;
    const size = options.size || product.sizes?.[0] || null;
    const color = options.color || product.colors?.[0]?.name || null;
    const key = lineKey(productId, size, color);

    setItems((previous) => {
      const existing = previous.find((item) => lineKey(item.productId, item.size, item.color) === key);
      if (existing) {
        const next = clampQuantity(existing.quantity + quantity, product.stock);
        if (next === 0) return previous;
        return previous.map((item) =>
          item === existing ? { ...item, quantity: next, selected: true } : item,
        );
      }

      const first = clampQuantity(quantity, product.stock);
      if (first === 0 || previous.length >= MAX_CART_LINES) return previous;
      return [
        ...previous,
        {
          productId,
          size,
          color,
          quantity: first,
          selected: true,
          priceSeenMinor: Number.isInteger(product.priceMinor) ? product.priceMinor : null,
        },
      ];
    });
  };

  const matches = (item, key) => lineKey(item.productId, item.size, item.color) === key;

  const toggleSelectItem = (key) =>
    setItems((previous) =>
      previous.map((item) => (matches(item, key) ? { ...item, selected: !item.selected } : item)),
    );

  const toggleSelectAll = (selectState) =>
    setItems((previous) => previous.map((item) => ({ ...item, selected: selectState })));

  const removeFromCart = (key) => setItems((previous) => previous.filter((item) => !matches(item, key)));

  /** Change a line's quantity by +1 / -1. Never below 1 (use remove) and never above stock or the cap. */
  const updateQuantity = (key, delta) =>
    setItems((previous) =>
      previous.map((item) => {
        if (!matches(item, key)) return item;
        const stock = productsById.get(item.productId)?.stock;
        const next = clampQuantity(item.quantity + delta, stock);
        return next === 0 ? item : { ...item, quantity: next };
      }),
    );

  /** The customer has seen the new price: stop showing the "price changed" notice. */
  const acknowledgePriceChange = (key) =>
    setItems((previous) =>
      previous.map((item) => {
        if (!matches(item, key)) return item;
        const price = productsById.get(item.productId)?.priceMinor;
        return Number.isInteger(price) ? { ...item, priceSeenMinor: price } : item;
      }),
    );

  const clearCart = () => setItems([]);

  /** Remove only what was just bought (ticked and available) after a successful order. */
  const removeSelectedItems = () => {
    const bought = new Set(purchasableSelected(lines).map((line) => line.key));
    setItems((previous) => previous.filter((item) => !bought.has(lineKey(item.productId, item.size, item.color))));
  };

  const selectedCart = purchasableSelected(lines);

  const value = {
    cart: lines,
    selectedCart,
    isCartOpen,
    setIsCartOpen,
    isCartLoading: isLoading,
    isCartError: isError,
    refetchCart: refetch,
    addToCart,
    toggleSelectItem,
    toggleSelectAll,
    removeFromCart,
    updateQuantity,
    acknowledgePriceChange,
    clearCart,
    removeSelectedItems,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    selectedItemsCount: countUnits(selectedCart),
    /** Whole cents, from live database prices. */
    subtotalMinor: sumSubtotalMinor(selectedCart),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart =() => useContext(CartContext);
