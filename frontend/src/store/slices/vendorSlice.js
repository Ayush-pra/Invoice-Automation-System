import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchVendorCatalog = createAsyncThunk(
  'vendors/fetchCatalog',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/vendors');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch vendor catalog');
    }
  }
);

export const searchVendors = createAsyncThunk(
  'vendors/search',
  async (query, { rejectWithValue }) => {
    try {
      const response = await api.get(`/vendors/search?q=${encodeURIComponent(query)}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to search vendors');
    }
  }
);

const vendorSlice = createSlice({
  name: 'vendors',
  initialState: {
    catalog: {}, // Grouped by category
    searchResults: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearSearchResults: (state) => {
      state.searchResults = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorCatalog.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorCatalog.fulfilled, (state, action) => {
        state.loading = false;
        state.catalog = action.payload;
      })
      .addCase(fetchVendorCatalog.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(searchVendors.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSearchResults } = vendorSlice.actions;
export default vendorSlice.reducer;
