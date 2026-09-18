import { useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/useCart';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function CartPage() {
  const { cart, cartId, isCartLoading, cartError, itemCount, isUpdating, isRemoving, updateItem, removeItem } = useCart();
  const { darkMode } = useTheme();
  const [pendingAction, setPendingAction] = useState<{ productId: number; action: 'update' | 'remove' } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const totalLabel = useMemo(() => {
    if (!cart) {
      return '0';
    }
    return formatCurrency(cart.total);
  }, [cart]);

  const handleQuantityChange = async (productId: number, nextQuantity: number) => {
    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      setStatusMessage('Quantity must be greater than zero.');
      return;
    }

    try {
      setPendingAction({ productId, action: 'update' });
      setStatusMessage(null);
      await updateItem(productId, nextQuantity);
      setStatusMessage('Cart updated successfully.');
    } catch (error) {
      setStatusMessage('Unable to update this item.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemove = async (productId: number) => {
    try {
      setPendingAction({ productId, action: 'remove' });
      setStatusMessage(null);
      await removeItem(productId);
      setStatusMessage('Item removed from cart.');
    } catch (error) {
      setStatusMessage('Unable to remove this item.');
    } finally {
      setPendingAction(null);
    }
  };

  if (!cartId) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-xl border p-10 text-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>Your cart is empty</h1>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} mt-4`}>
              Add one or more products to create your server-backed cart.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isCartLoading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-xl border p-8 ${darkMode ? 'bg-gray-800 border-red-700 text-red-300' : 'bg-white border-red-200 text-red-700'}`}>
            <h1 className="text-2xl font-bold">Unable to load your cart</h1>
            <p className="mt-2">Please try again in a moment.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-xl border p-10 text-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>Your cart is empty</h1>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} mt-4`}>Start shopping to add products to this cart.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>Shopping cart</h1>
          <div className={`rounded-full px-4 py-2 text-sm ${darkMode ? 'bg-gray-800 text-light' : 'bg-white text-gray-700'}`}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </div>
        </div>

        {statusMessage && (
          <div aria-live="polite" className={`mb-6 rounded-lg px-4 py-3 text-sm ${darkMode ? 'bg-gray-800 text-light' : 'bg-white text-gray-700'}`}>
            {statusMessage}
          </div>
        )}

        <div className={`rounded-2xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {cart.items.map((item) => {
              const isBusy = pendingAction?.productId === item.productId && (isUpdating || isRemoving || pendingAction?.action === 'update' || pendingAction?.action === 'remove');

              return (
                <div key={item.cartItemId} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <img src={`/${item.imgName ?? 'placeholder.png'}`} alt={item.name} className="h-20 w-20 object-contain rounded-lg bg-gray-100 p-2" />
                    <div className="min-w-0">
                      <h2 className={`text-lg font-semibold truncate ${darkMode ? 'text-light' : 'text-gray-800'}`}>{item.name}</h2>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                        Unit price: {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap justify-between md:justify-end w-full md:w-auto">
                    <div className={`flex items-center gap-3 rounded-lg px-2 py-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <button
                        type="button"
                        aria-label={`Decrease quantity for ${item.name}`}
                        onClick={() => handleQuantityChange(item.productId, Math.max(1, item.quantity - 1))}
                        disabled={isBusy}
                        className="h-8 w-8 rounded-md bg-white text-gray-800 disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className={`min-w-6 text-center ${darkMode ? 'text-light' : 'text-gray-800'}`}>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity for ${item.name}`}
                        onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}
                        disabled={isBusy}
                        className="h-8 w-8 rounded-md bg-white text-gray-800 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-24 text-right">
                      <p className={`font-semibold ${darkMode ? 'text-light' : 'text-gray-800'}`}>{formatCurrency(item.lineTotal)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.productId)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500 px-3 py-2 text-sm text-red-500 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 7h12M9 7V4h6v3m-7 0l1 12h8l1-12" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`flex items-center justify-between px-6 py-5 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Total</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>{totalLabel}</p>
            </div>
            <div className={`text-right text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <div>{itemCount} items</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
