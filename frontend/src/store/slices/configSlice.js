import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchConfig = createAsyncThunk(
  'config/fetchConfig',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/config');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch config');
    }
  }
);

export const updateConfig = createAsyncThunk(
  'config/updateConfig',
  async (configData, { rejectWithValue }) => {
    try {
      const response = await api.put('/config', configData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update config');
    }
  }
);

const configSlice = createSlice({
  name: 'config',
  initialState: {
    data: null,
    loading: false,
    saving: false,
    error: null,
  },
  reducers: {
    clearConfigError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConfig.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConfig.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchConfig.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateConfig.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateConfig.fulfilled, (state, action) => {
        state.saving = false;
        state.data = action.payload;
      })
      .addCase(updateConfig.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { clearConfigError } = configSlice.actions;
export default configSlice.reducer;
