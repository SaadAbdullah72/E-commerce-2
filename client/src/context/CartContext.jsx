import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const localData = localStorage.getItem('shopyaro_cart');
    return localData ? JSON.parse(localData) : [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('shopyaro_cart', JSON.stringify(cart));
  }, [cart]);

  // Add item with selected = true by default
  const addToCart = (product, quantity = 1, variant = null) => {
    const qtyToAdd = Number(quantity) > 0 ? Number(quantity) : 1;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => String(item._id) === String(product._id) && item.variant === variant
      );

      if (existingIndex > -1) {
        return prevCart.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + qtyToAdd, selected: true }
            : item
        );
      }

      return [
        ...prevCart,
        {
          ...product,
          quantity: qtyToAdd,
          variant: variant,
          selected: true,
        },
      ];
    });
  };

  // Toggle selection for a single item
  const toggleSelectItem = (id, variant = null) => {
    setCart((prev) =>
      prev.map((item) =>
        String(item._id) === String(id) && item.variant === variant
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  // Select or Deselect All
  const toggleSelectAll = (selectState) => {
    setCart((prev) => prev.map((item) => ({ ...item, selected: selectState })));
  };

  const removeFromCart = (id, variant = null) => {
    setCart((prev) => prev.filter((item) => !(String(item._id) === String(id) && item.variant === variant)));
  };

  const updateQuantity = (id, variant, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (String(item._id) === String(id) && item.variant === variant) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const clearCart = () => setCart([]);

  // Removes ONLY selected/purchased items after a successful order
  const removeSelectedItems = () => {
    setCart((prev) => prev.filter((item) => !item.selected));
  };

  // Calculated properties based on selected items
  const selectedCart = cart.filter((item) => item.selected);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedItemsCount = selectedCart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = selectedCart.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        selectedCart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        toggleSelectItem,
        toggleSelectAll,
        removeFromCart,
        updateQuantity,
        clearCart,
        removeSelectedItems,
        totalItems,
        selectedItemsCount,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);