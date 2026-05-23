import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext()

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false, showLogoutAnimation: false }
    case 'LOGOUT':
      return { user: null, loading: false, showLogoutAnimation: true }
    case 'HIDE_LOGOUT_ANIMATION':
      return { ...state, showLogoutAnimation: false }
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    loading: true,
    showLogoutAnimation: false
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authAPI.me()
        .then(response => {
          if (response.data.success) {
            dispatch({ type: 'SET_USER', payload: response.data.user })
          } else {
            localStorage.removeItem('token')
            dispatch({ type: 'SET_LOADING', payload: false })
          }
        })
        .catch(() => {
          localStorage.removeItem('token')
          dispatch({ type: 'SET_LOADING', payload: false })
        })
    } else {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const login = (userData, token) => {
    console.log('AuthContext login called with:', { userData, token }); // Debug log
    localStorage.setItem('token', token)
    dispatch({ type: 'SET_USER', payload: userData })
  }

  const logout = () => {
    localStorage.removeItem('token')
    dispatch({ type: 'LOGOUT' })
  }

  const hideLogoutAnimation = () => {
    dispatch({ type: 'HIDE_LOGOUT_ANIMATION' })
  }

  return (
    <AuthContext.Provider value={{
      user: state.user,
      loading: state.loading,
      showLogoutAnimation: state.showLogoutAnimation,
      login,
      logout,
      hideLogoutAnimation
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}