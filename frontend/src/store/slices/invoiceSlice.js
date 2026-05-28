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
      });
  },
});

export const { clearSyncResult, clearError } = invoiceSlice.actions;
export default invoiceSlice.reducer;
