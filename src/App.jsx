import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from './store'
import './App.css'

// Import components
import Header from './components/Header'

// Import pages
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import GiftFinder from './pages/GiftFinder'
import Profile from './pages/Profile'
import PrivateRoute from './components/PrivateRoute'

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <div className="app-container">
            <Header />
            <main className="main-content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<Home />} />
                <Route 
                  path="/gift-finder" 
                  element={
                    <PrivateRoute>
                      <GiftFinder />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  } 
                />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  )
}

export default App