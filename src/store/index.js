import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import authReducer from './slices/authSlice'
import giftReducer from './slices/giftSlice'
import giftFinderReducer from './slices/giftFinderSlice'

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'giftFinder']
}

const rootReducer = combineReducers({
  auth: authReducer,
  gifts: giftReducer,
  giftFinder: giftFinderReducer
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export const persistor = persistStore(store)