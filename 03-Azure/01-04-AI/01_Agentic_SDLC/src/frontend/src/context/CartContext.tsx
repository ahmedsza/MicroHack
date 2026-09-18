import axios, { AxiosError } from 'axios';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { api } from '../api/config';

export interface CartItem {
  cartItemId: number;
  productId: number;
  name: string;
  imgName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cart {
  cartId: number;
  createdAt: string;
  items: CartItem[];
  itemCount: number;
  total: number;
}

export interface AddCartItemRequest {
  productId: number;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

const CART_STORAGE_KEY = 'octocat-cart-id';

const fetchCart = async (cartId: number): Promise<Cart> => {
  const { data } = await axios.get(`${api.baseURL}${api.endpoints.cart}/${cartId}`);
  return data as Cart;
};

interface CartContextValue {
  cartId: number | null;
  cart: Cart | undefined;
  itemCount: number;
  isCartLoading: boolean;
  isCartError: boolean;
  cartError: AxiosError | null;
  isAdding: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  addItem: (productId: number, quantity: number) => Promise<Cart>;
  updateItem: (productId: number, quantity: number) => Promise<Cart>;
  removeItem: (productId: number) => Promise<void>;
  refreshCart: () => Promise<void>;
  clearCartId: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [cartId, setCartId] = useState<number | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const storedCartId = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCartId) {
      return null;
    }

    const parsedCartId = Number(storedCartId);
    return Number.isFinite(parsedCartId) && parsedCartId > 0 ? parsedCartId : null;
  });

  const persistCartId = useCallback((nextCartId: number | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (nextCartId === null) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, String(nextCartId));
  }, []);

  const clearCartId = useCallback(() => {
    setCartId(null);
    persistCartId(null);
    queryClient.removeQueries(['cart']);
  }, [persistCartId, queryClient]);

  const { data: cart, isLoading: isCartLoading, isError: isCartError, error: cartError, refetch: refreshCartQuery } = useQuery<Cart, AxiosError>(
    cartId ? ['cart', cartId] : 'cart-disabled',
    () => fetchCart(cartId as number),
    {
      enabled: !!cartId,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (cartId !== null) {
      persistCartId(cartId);
    }
  }, [cartId, persistCartId]);

  useEffect(() => {
    if (isCartError && (cartError as AxiosError | undefined)?.response?.status === 404) {
      clearCartId();
    }
  }, [cartError, clearCartId, isCartError]);

  const createCart = useCallback(async (): Promise<number> => {
    const { data } = await axios.post(`${api.baseURL}${api.endpoints.cart}`);
    const nextCartId = Number(data.cartId);
    setCartId(nextCartId);
    persistCartId(nextCartId);
    queryClient.setQueryData(['cart', nextCartId], data);
    return nextCartId;
  }, [persistCartId, queryClient]);

  const addMutation = useMutation(
    async ({ productId, quantity }: AddCartItemRequest) => {
      const activeCartId = cartId ?? (await createCart());
      const { data } = await axios.post(`${api.baseURL}${api.endpoints.cart}/${activeCartId}/items`, {
        productId,
        quantity,
      });
      return data as Cart;
    },
    {
      onSuccess: (data) => {
        setCartId(data.cartId);
        persistCartId(data.cartId);
        queryClient.setQueryData(['cart', data.cartId], data);
      },
    },
  );

  const updateMutation = useMutation(
    async ({ productId, quantity }: { productId: number; quantity: number }) => {
      if (!cartId) {
        throw new Error('Cannot update items without a cart ID');
      }

      const { data } = await axios.put(`${api.baseURL}${api.endpoints.cart}/${cartId}/items/${productId}`, {
        quantity,
      });
      return data as Cart;
    },
    {
      onSuccess: (data) => {
        queryClient.setQueryData(['cart', data.cartId], data);
      },
    },
  );

  const removeMutation = useMutation(
    async (productId: number) => {
      if (!cartId) {
        throw new Error('Cannot remove items without a cart ID');
      }

      await axios.delete(`${api.baseURL}${api.endpoints.cart}/${cartId}/items/${productId}`);
      await queryClient.invalidateQueries(['cart', cartId]);
    },
    {
      onSuccess: () => {
        if (cartId) {
          queryClient.invalidateQueries(['cart', cartId]);
        }
      },
    },
  );

  const addItem = useCallback(
    async (productId: number, quantity: number) => {
      return addMutation.mutateAsync({ productId, quantity });
    },
    [addMutation],
  );

  const updateItem = useCallback(
    async (productId: number, quantity: number) => {
      return updateMutation.mutateAsync({ productId, quantity });
    },
    [updateMutation],
  );

  const removeItem = useCallback(
    async (productId: number) => {
      await removeMutation.mutateAsync(productId);
    },
    [removeMutation],
  );

  const refreshCart = useCallback(async () => {
    if (!cartId) {
      return;
    }

    await refreshCartQuery();
  }, [cartId, refreshCartQuery]);

  const value = useMemo<CartContextValue>(
    () => ({
      cartId,
      cart,
      itemCount: cart?.itemCount ?? 0,
      isCartLoading,
      isCartError,
      cartError: (cartError as AxiosError | null) ?? null,
      isAdding: addMutation.isLoading,
      isUpdating: updateMutation.isLoading,
      isRemoving: removeMutation.isLoading,
      addItem,
      updateItem,
      removeItem,
      refreshCart,
      clearCartId,
    }),
    [addItem, addMutation.isLoading, cart, cartError, cartId, clearCartId, isCartError, isCartLoading, refreshCart, removeItem, removeMutation.isLoading, updateItem, updateMutation.isLoading],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
