import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';

const parseError = (error) => error?.message || 'Unexpected error';

const normalizeList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.rows)) {
    return data.rows;
  }
  return [];
};

const useEntityApi = (resource, initialParams = {}) => {
  const queryClient = useQueryClient();
  const [queryParams, setQueryParams] = useState(initialParams);
  const [mutationError, setMutationError] = useState('');

  const baseKey = useMemo(() => [resource], [resource]);
  const queryKey = useMemo(() => [resource, queryParams], [resource, queryParams]);

  const updateCachedLists = useCallback(
    (updater) => {
      const queries = queryClient.getQueriesData({ queryKey: baseKey });
      queries.forEach(([key, existing]) => {
        const current = normalizeList(existing);
        const next = updater(current);
        queryClient.setQueryData(key, next);
      });
    },
    [queryClient, baseKey]
  );

  const queryResult = useQuery({
    queryKey,
    keepPreviousData: true,
    queryFn: async ({ queryKey: [, params] }) => {
      const { data } = await client.get(`/${resource}`, { params });
      return normalizeList(data);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await client.post(`/${resource}`, payload);
      return data;
    },
    onSuccess: (data) => {
      updateCachedLists((current) => [data, ...current]);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await client.put(`/${resource}/${id}`, payload);
      return data;
    },
    onSuccess: (data) => {
      updateCachedLists((current) => current.map((item) => (item.id === data.id ? data : item)));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await client.delete(`/${resource}/${id}`);
      return id;
    },
    onSuccess: (id) => {
      updateCachedLists((current) => current.filter((item) => item.id !== id));
    }
  });

  const handleMutation = useCallback(async (mutation, variables, onSuccessFormatter) => {
    setMutationError('');
    try {
      const result = await mutation.mutateAsync(variables);
      const data = onSuccessFormatter ? onSuccessFormatter(result) : result;
      return { success: true, data };
    } catch (err) {
      const message = parseError(err);
      setMutationError(message);
      return { success: false, message };
    }
  }, []);

  const createItem = useCallback(
    (payload) => handleMutation(createMutation, payload),
    [createMutation, handleMutation]
  );

  const updateItem = useCallback(
    (id, payload) => handleMutation(updateMutation, { id, payload }),
    [handleMutation, updateMutation]
  );

  const deleteItem = useCallback(async (id) => {
    const result = await handleMutation(deleteMutation, id);
    if (result.success) {
      return { success: true };
    }
    return result;
  }, [deleteMutation, handleMutation]);

  const call = useCallback(
    async (method, path = '/', payload = null) => {
      setMutationError('');
      try {
        const url = `${path.startsWith('/') ? '' : '/'}${path}`;
        const response = await client.request({ method, url: `/${resource}${url}`, data: payload });
        return { success: true, data: response.data };
      } catch (err) {
        const message = parseError(err);
        setMutationError(message);
        return { success: false, message };
      }
    },
    [resource]
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: baseKey, exact: false });
  }, [queryClient, baseKey]);

  const setParams = useCallback((newParams) => {
    setQueryParams((prev) => ({ ...(prev || {}), ...(newParams || {}) }));
  }, []);

  const items = queryResult.data || [];
  const loading = queryResult.isLoading || queryResult.isFetching;
  const error = queryResult.error ? parseError(queryResult.error) : mutationError;

  return {
    items,
    loading,
    error,
    refresh,
    createItem,
    updateItem,
    deleteItem,
    call,
    setParams
  };
};

export default useEntityApi;
