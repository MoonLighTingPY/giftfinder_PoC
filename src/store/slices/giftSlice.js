// store/slices/giftSlice.js
import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  recommendations: [],
  loading: false,
  error: null
}

export const giftSlice = createSlice({
  name: 'gifts',
  initialState,
  reducers: {
    getGiftsStart: (state) => {
      state.loading = true
      state.error = null
    },
    getGiftsSuccess: (state, action) => {
      state.recommendations = action.payload
      state.loading = false
    },
    getGiftsFailed: (state, action) => {
      state.loading = false
      state.error = action.payload
    },
    clearGifts: (state) => {
      state.recommendations = []
    }
  }
})

export const { 
  getGiftsStart, 
  getGiftsSuccess, 
  getGiftsFailed,
  clearGifts
} = giftSlice.actions

export default giftSlice.reducer