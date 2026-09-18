import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { api } from '../api/config';
import { useTheme } from '../context/ThemeContext';

interface OrderHistoryItem {
  orderDetailId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
  name?: string;
  description?: string | null;
}

interface OrderHistory {
  orderId: number;
  branchId: number;
  orderDate: string;
  name: string;
  description: string;
  status: string;
  total: number;
  items: OrderHistoryItem[];
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const fetchOrderHistory = async (): Promise<OrderHistory[]> => {
  const { data } = await axios.get(`${api.baseURL}${api.endpoints.orders}?branchId=1`);
  return data;
};

// Deze pagina toont orderhistoriek voor een branch.
export default function OrderHistoryPage() {
  const { darkMode } = useTheme();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { data: orders = [], isLoading, error } = useQuery('order-history', fetchOrderHistory);

  useEffect(() => {
    if (orders.length > 0 && selectedOrderId === null) {
      setSelectedOrderId(orders[0].orderId);
    }
  }, [orders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) ?? orders[0] ?? null,
    [orders, selectedOrderId],
  );

  if (isLoading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto">
          <div className={`rounded-xl border p-8 ${darkMode ? 'bg-gray-800 border-red-700 text-red-300' : 'bg-white border-red-200 text-red-700'}`}>
            <h1 className="text-2xl font-bold">Unable to load order history</h1>
            <p className="mt-2">Please try again in a moment.</p>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-xl border p-10 text-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>No order history yet</h1>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} mt-4`}>
              There are no orders for this branch yet. Once a new order is placed, it will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-dark' : 'bg-gray-100'} pt-24 px-4 transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>Order History</h1>
          <span className={`rounded-full px-3 py-1 text-sm ${darkMode ? 'bg-gray-800 text-light' : 'bg-white text-gray-700'}`}>
            {orders.length} order{orders.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="space-y-4">
            {orders.map((order) => {
              const isSelected = selectedOrder?.orderId === order.orderId;

              return (
                <button
                  key={order.orderId}
                  type="button"
                  onClick={() => setSelectedOrderId(order.orderId)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? darkMode
                        ? 'border-primary bg-primary/10'
                        : 'border-primary bg-primary/5'
                      : darkMode
                        ? 'border-gray-700 bg-gray-800 hover:border-primary/60'
                        : 'border-gray-200 bg-white hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-lg font-semibold ${darkMode ? 'text-light' : 'text-gray-800'}`}>{order.name}</p>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                        {new Date(order.orderDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
                    <span className={`font-semibold ${darkMode ? 'text-light' : 'text-gray-800'}`}>{formatCurrency(order.total)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedOrder && (
            <div className={`rounded-2xl border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Selected order
                  </p>
                  <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>{selectedOrder.name}</h2>
                </div>
                <div className="text-right">
                  <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Total</p>
                  <p className={`text-xl font-bold ${darkMode ? 'text-light' : 'text-gray-800'}`}>
                    {formatCurrency(selectedOrder.total)}
                  </p>
                </div>
              </div>

              <div className={`mt-6 rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} p-4`}>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                  Order date: {new Date(selectedOrder.orderDate).toLocaleString()}
                </p>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm mt-1`}>
                  Status: <span className="font-semibold text-primary">{selectedOrder.status}</span>
                </p>
                {selectedOrder.description && (
                  <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm mt-1`}>
                    {selectedOrder.description}
                  </p>
                )}
              </div>

              <div className="mt-6">
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-light' : 'text-gray-800'} mb-3`}>Line items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.orderDetailId}
                      className={`flex items-center justify-between rounded-lg border p-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div>
                        <p className={`font-medium ${darkMode ? 'text-light' : 'text-gray-800'}`}>{item.name ?? 'Product'}</p>
                        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <p className={`font-semibold ${darkMode ? 'text-light' : 'text-gray-800'}`}>
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
