// src/store/slices/giftFinderSlice.js
import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    recipientInfo: {
        age: '',
        gender: '',
        interests: '',
        profession: '',
        budget: 'any',
        occasion: 'any'
    },
    useAi: true,
    gifts: [],
    dbGifts: [],
    aiStatus: null,
    requestId: null,
    error: '',
    isSearching: false,
    submittedCriteria: null
}

export const giftFinderSlice = createSlice({
    name: 'giftFinder',
    initialState,
    reducers: {
        updateFormField: (state, action) => {
            const { name, value } = action.payload
            state.recipientInfo[name] = value
        },
        toggleAi: (state) => {
            state.useAi = !state.useAi
        },
        setGifts: (state, action) => {
            state.gifts = action.payload
        },
        setDbGifts: (state, action) => {
            state.dbGifts = action.payload
        },
        setAiStatus: (state, action) => {
            state.aiStatus = action.payload
        },
        setRequestId: (state, action) => {
            state.requestId = action.payload
        },
        setError: (state, action) => {
            state.error = action.payload
        },
        setIsSearching: (state, action) => {
            state.isSearching = action.payload
        },
        setSubmittedCriteria: (state, action) => {
            state.submittedCriteria = action.payload
        },
        resetSearch: (state) => {
            state.gifts = []
            state.dbGifts = []
            state.aiStatus = null
            state.requestId = null
            state.error = ''
        }
    }
})

export const {
    updateFormField,
    toggleAi,
    setGifts,
    setDbGifts,
    setAiStatus,
    setRequestId,
    setError,
    setIsSearching,
    setSubmittedCriteria,
    resetSearch
} = giftFinderSlice.actions

export default giftFinderSlice.reducer