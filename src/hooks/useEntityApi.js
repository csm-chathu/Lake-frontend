import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client.js';

const parseError = (error) => error?.message || 'Unexpected error';

const useEntityApi = (resource, initialParams = {}) => {
  const paramsRef = useRef(initialParams);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.get(`/${resource}`, {
        params: paramsRef.current
      });
      setItems(Array.isArray(data) ? data : data?.rows || []);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [resource]);

  const createItem = useCallback(
    async (payload) => {
      try {
        setError('');
        const { data } = await client.post(`/${resource}`, payload);
        setItems((current) => [data, ...current]);
        return { success: true, data };
      } catch (err) {
        const message = parseError(err);
        setError(message);
        return { success: false, message };
      }
    },
    [resource]
  );

  const updateItem = useCallback(
    async (id, payload) => {
      try {
        setError('');
        const { data } = await client.put(`/${resource}/${id}`, payload);
        setItems((current) => current.map((item) => (item.id === id ? data : item)));
        return { success: true, data };
      } catch (err) {
        const message = parseError(err);
        setError(message);
        return { success: false, message };
      }
    },
    [resource]
  );

  const deleteItem = useCallback(
    async (id) => {
      try {
        setError('');
        await client.delete(`/${resource}/${id}`);
        setItems((current) => current.filter((item) => item.id !== id));
        return { success: true };
      } catch (err) {
        const message = parseError(err);
        setError(message);
        return { success: false, message };
      }
    },
    [resource]
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    refresh: fetchItems,
    createItem,
    updateItem,
    deleteItem
  };
};

export default useEntityApi;
