import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import invoiceReducer from './slices/invoiceSlice';
import vendorReducer from './slices/vendorSlice';
import configReducer from './slices/configSlice';
import vendorIntegrationReducer from './slices/vendorIntegrationSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    invoices: invoiceReducer,
    vendors: vendorReducer,
    config: configReducer,
    vendorIntegration: vendorIntegrationReducer,
  },
});

export default store;
