import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchVendorRegistry = createAsyncThunk(
  'vendorIntegration/fetchRegistry',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/vendors/registry');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch vendor registry');
    }
  }
);

export const fetchVendorIntegrations = createAsyncThunk(
  'vendorIntegration/fetchIntegrations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/vendors/integrations');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch vendor integrations');
    }
  }
);

export const validateVendorCredentials = createAsyncThunk(
  'vendorIntegration/validateCredentials',
  async ({ vendorName, credentials }, { rejectWithValue }) => {
    try {
      const response = await api.post('/vendors/integrations/validate', { vendorName, credentials });
      return response.data; // Includes message and data (the integration)
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Validation failed');
    }
  }
);

export const disconnectVendorIntegration = createAsyncThunk(
  'vendorIntegration/disconnect',
  async (vendorName, { rejectWithValue }) => {
    try {
      await api.delete(`/vendors/integrations/${vendorName}`);
      return vendorName;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to disconnect vendor');
    }
  }
);

const vendorIntegrationSlice = createSlice({
  name: 'vendorIntegration',
  initialState: {
    registry: {}, // Capabilities + Required credential fields per vendor
    integrations: [], // Connected vendor integrations
    loadingRegistry: false,
    loadingIntegrations: false,
    validating: false,
    error: null,
    validationResult: null,
  },
  reducers: {
    clearValidationError: (state) => {
      state.error = null;
      state.validationResult = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Registry
      .addCase(fetchVendorRegistry.pending, (state) => {
        state.loadingRegistry = true;
      })
      .addCase(fetchVendorRegistry.fulfilled, (state, action) => {
        state.loadingRegistry = false;
        state.registry = action.payload;
      })
      .addCase(fetchVendorRegistry.rejected, (state, action) => {
        state.loadingRegistry = false;
        console.error("Registry fetch failed", action.payload);
      })
      
      // Integrations
      .addCase(fetchVendorIntegrations.pending, (state) => {
        state.loadingIntegrations = true;
      })
      .addCase(fetchVendorIntegrations.fulfilled, (state, action) => {
        state.loadingIntegrations = false;
        state.integrations = action.payload;
      })
      .addCase(fetchVendorIntegrations.rejected, (state, action) => {
        state.loadingIntegrations = false;
      })
      
      // Validate
      .addCase(validateVendorCredentials.pending, (state) => {
        state.validating = true;
        state.error = null;
        state.validationResult = null;
      })
      .addCase(validateVendorCredentials.fulfilled, (state, action) => {
        state.validating = false;
        state.validationResult = { success: true, message: action.payload.message };
        
        // Update local integrations list
        const updatedIntegration = action.payload.data;
        const index = state.integrations.findIndex(i => i.vendorName === updatedIntegration.vendorName);
        if (index >= 0) {
          state.integrations[index] = updatedIntegration;
        } else {
          state.integrations.push(updatedIntegration);
        }
      })
      .addCase(validateVendorCredentials.rejected, (state, action) => {
        state.validating = false;
        state.error = action.payload;
        state.validationResult = { success: false, message: action.payload };
      })

      // Disconnect
      .addCase(disconnectVendorIntegration.fulfilled, (state, action) => {
        state.integrations = state.integrations.filter(i => i.vendorName !== action.payload);
      });
  },
});

export const { clearValidationError } = vendorIntegrationSlice.actions;
export default vendorIntegrationSlice.reducer;
