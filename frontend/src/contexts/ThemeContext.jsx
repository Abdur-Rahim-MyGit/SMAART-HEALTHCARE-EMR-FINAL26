import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage immediately to prevent flash
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme
    }
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return systemPrefersDark ? 'dark' : 'light'
  })

  // Apply theme class to document element
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    // Save theme preference to localStorage
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
