import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// Fetch invoices
export const fetchInvoices = createAsyncThunk(
  'invoices/fetchInvoices',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/invoices', { params });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch invoices');
    }
  }
);

// Sync invoices from Gmail
export const syncInvoices = createAsyncThunk(
  'invoices/syncInvoices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/invoices/sync');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to sync invoices');
    }
  }
);

export const toggleReadStatus = createAsyncThunk(
  'invoices/toggleReadStatus',
  async ({ id, isRead }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/invoices/${id}/read`, { isRead });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update read status');
    }
  }
);

export const deleteInvoice = createAsyncThunk(
  'invoices/deleteInvoice',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/invoices/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete invoice');
    }
  }
);

export const bulkDeleteInvoices = createAsyncThunk(
  'invoices/bulkDeleteInvoices',
  async (invoiceIds, { rejectWithValue }) => {
    try {
      await api.post('/invoices/bulk-delete', { invoiceIds });
      return invoiceIds;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bulk delete invoices');
    }
  }
);

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState: {
    invoices: [],
    pagination: null,
    loading: false,
    syncing: false,
    syncResult: null,
    error: null,
  },
  reducers: {
    clearSyncResult: (state) => {
      state.syncResult = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchInvoices
      .addCase(fetchInvoices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.invoices = action.payload.invoices;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // syncInvoices
      .addCase(syncInvoices.pending, (state) => {
        state.syncing = true;
        state.syncResult = null;
        state.error = null;
      })
      .addCase(syncInvoices.fulfilled, (state, action) => {
        state.syncing = false;
        state.syncResult = action.payload;
      })
      .addCase(syncInvoices.rejected, (state, action) => {
        state.syncing = false;
        state.error = action.payload;
      })
      // toggleReadStatus
      .addCase(toggleReadStatus.fulfilled, (state, action) => {
        const updatedInvoice = action.payload;
        const index = state.invoices.findIndex(inv => inv._id === updatedInvoice._id);
        if (index !== -1) {
          state.invoices[index] = updatedInvoice;
        }
      })
      // deleteInvoice
      .addCase(deleteInvoice.fulfilled, (state, action) => {
        const deletedId = action.payload;
        state.invoices = state.invoices.filter(inv => inv._id !== deletedId);
      })
      // bulkDeleteInvoices
      .addCase(bulkDeleteInvoices.fulfilled, (state, action) => {
        const deletedIds = action.payload;
        state.invoices = state.invoices.filter(inv => !deletedIds.includes(inv._id));
      });
  },
});

export const { clearSyncResult, clearError } = invoiceSlice.actions;
export default invoiceSlice.reducer;
