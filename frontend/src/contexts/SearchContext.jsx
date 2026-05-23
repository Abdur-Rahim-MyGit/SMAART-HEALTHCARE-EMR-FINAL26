import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import searchAPI from '../services/searchAPI';

const SearchContext = createContext();

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Define searchable items based on user role
  const getSearchableItems = () => {
    const baseItems = [
      { 
        id: 'dashboard', 
        title: 'Dashboard', 
        description: 'Main dashboard overview', 
        path: '/', 
        category: 'Navigation',
        keywords: ['dashboard', 'home', 'overview', 'main']
      },
      { 
        id: 'settings', 
        title: 'Settings', 
        description: 'Application settings and preferences', 
        path: '/settings', 
        category: 'System',
        keywords: ['settings', 'preferences', 'configuration', 'options']
      }
    ];

    const roleBasedItems = {
      super_master_admin: [
        { 
          id: 'clinics', 
          title: 'Clinic Management', 
          description: 'Manage all clinics in the system', 
          path: '/clinics', 
          category: 'Management',
          keywords: ['clinics', 'clinic', 'management', 'hospitals', 'facilities']
        },
        { 
          id: 'patients', 
          title: 'Patient List', 
          description: 'View and manage all patients', 
          path: '/patients', 
          category: 'Patients',
          keywords: ['patients', 'patient', 'list', 'medical records', 'people']
        },
        { 
          id: 'appointments', 
          title: 'Appointments', 
          description: 'Manage all appointments', 
          path: '/appointments', 
          category: 'Scheduling',
          keywords: ['appointments', 'appointment', 'schedule', 'booking', 'calendar']
        },
        { 
          id: 'doctors', 
          title: 'Doctors Management', 
          description: 'Manage doctors and medical staff', 
          path: '/doctors', 
          category: 'Staff',
          keywords: ['doctors', 'doctor', 'physicians', 'medical staff', 'staff']
        },
        { 
          id: 'nurses', 
          title: 'Nurses Management', 
          description: 'Manage nursing staff', 
          path: '/nurses', 
          category: 'Staff',
          keywords: ['nurses', 'nurse', 'nursing staff', 'medical staff']
        },
        { 
          id: 'referrals', 
          title: 'Referrals', 
          description: 'Patient referrals and transfers', 
          path: '/referrals', 
          category: 'Medical',
          keywords: ['referrals', 'referral', 'transfer', 'specialist']
        },
        { 
          id: 'reports', 
          title: 'Reports & Analytics', 
          description: 'System reports and analytics', 
          path: '/reports-analytics', 
          category: 'Analytics',
          keywords: ['reports', 'analytics', 'statistics', 'data', 'insights']
        },
        { 
          id: 'billing', 
          title: 'Billing & Insurance', 
          description: 'Financial management and insurance', 
          path: '/billing-insurance', 
          category: 'Financial',
          keywords: ['billing', 'insurance', 'payment', 'financial', 'money']
        },
        { 
          id: 'pharmacy', 
          title: 'Pharmacy Management', 
          description: 'Manage pharmacy and medications', 
          path: '/pharmacy', 
          category: 'Pharmacy',
          keywords: ['pharmacy', 'medications', 'drugs', 'prescriptions', 'medicine']
        },
        { 
          id: 'support', 
          title: 'Customer Support', 
          description: 'Help and support center', 
          path: '/support', 
          category: 'Support',
          keywords: ['support', 'help', 'customer service', 'assistance']
        }
      ],
      super_admin: [
        { 
          id: 'users', 
          title: 'Staff Management', 
          description: 'Manage clinic staff', 
          path: '/users', 
          category: 'Staff',
          keywords: ['staff', 'users', 'employees', 'team']
        },
        { 
          id: 'patients', 
          title: 'Patients', 
          description: 'View and manage patients', 
          path: '/patients', 
          category: 'Patients',
          keywords: ['patients', 'patient', 'medical records']
        },
        { 
          id: 'appointments', 
          title: 'Appointments', 
          description: 'Manage appointments', 
          path: '/appointments', 
          category: 'Scheduling',
          keywords: ['appointments', 'appointment', 'schedule', 'booking']
        },
        { 
          id: 'billing', 
          title: 'Billing', 
          description: 'Billing and payments', 
          path: '/billing', 
          category: 'Financial',
          keywords: ['billing', 'payment', 'financial', 'invoice']
        }
      ],
      clinic_admin: [
        { 
          id: 'patients', 
          title: 'Patients', 
          description: 'Clinic patients', 
          path: '/patients', 
          category: 'Patients',
          keywords: ['patients', 'patient', 'medical records']
        },
        { 
          id: 'appointments', 
          title: 'Appointments', 
          description: 'Patient appointments', 
          path: '/appointments', 
          category: 'Scheduling',
          keywords: ['appointments', 'appointment', 'schedule', 'booking']
        },
        { 
          id: 'doctors', 
          title: 'Doctors', 
          description: 'Clinic doctors', 
          path: '/doctors', 
          category: 'Staff',
          keywords: ['doctors', 'doctor', 'physicians']
        }
      ],
      doctor: [
        { 
          id: 'appointments', 
          title: 'Appointments', 
          description: 'My appointments', 
          path: '/appointments', 
          category: 'Scheduling',
          keywords: ['appointments', 'appointment', 'schedule', 'patients']
        },
        { 
          id: 'patients', 
          title: 'Patients', 
          description: 'My patients', 
          path: '/patients', 
          category: 'Patients',
          keywords: ['patients', 'patient', 'medical records']
        }
      ],
      nurse: [
        { 
          id: 'appointments', 
          title: 'Appointments', 
          description: 'Patient appointments', 
          path: '/appointments', 
          category: 'Scheduling',
          keywords: ['appointments', 'appointment', 'schedule']
        },
        { 
          id: 'patients', 
          title: 'Patients', 
          description: 'Patient records', 
          path: '/patients', 
          category: 'Patients',
          keywords: ['patients', 'patient', 'medical records']
        }
      ],
      billing_staff: [
        { 
          id: 'billing', 
          title: 'Billing', 
          description: 'Billing management', 
          path: '/billing', 
          category: 'Financial',
          keywords: ['billing', 'payment', 'invoice', 'financial']
        }
      ],
      pharmacy_staff: [
        { 
          id: 'pharmacy', 
          title: 'Pharmacy', 
          description: 'Pharmacy management', 
          path: '/pharmacy', 
          category: 'Pharmacy',
          keywords: ['pharmacy', 'medications', 'drugs', 'prescriptions']
        }
      ],
      patient: [
        { 
          id: 'appointments', 
          title: 'My Appointments', 
          description: 'View my appointments', 
          path: '/appointments', 
          category: 'Personal',
          keywords: ['appointments', 'appointment', 'my appointments', 'schedule']
        },
        { 
          id: 'reports', 
          title: 'Medical Reports', 
          description: 'My medical reports', 
          path: '/reports', 
          category: 'Personal',
          keywords: ['reports', 'medical reports', 'test results', 'documents']
        }
      ]
    };

    // Add quick actions
    const quickActions = [
      { 
        id: 'notifications', 
        title: 'Notifications', 
        description: 'View notifications and alerts', 
        path: '#notifications', 
        category: 'Quick Actions',
        keywords: ['notifications', 'alerts', 'messages', 'updates'],
        action: () => {
          // Toggle notifications panel
          console.log('Opening notifications');
        }
      },
      { 
        id: 'profile', 
        title: 'Profile Settings', 
        description: 'Edit your profile information', 
        path: '/settings', 
        category: 'Quick Actions',
        keywords: ['profile', 'account', 'personal info', 'user settings']
      },
      { 
        id: 'logout', 
        title: 'Logout', 
        description: 'Sign out of your account', 
        path: '#logout', 
        category: 'Quick Actions',
        keywords: ['logout', 'sign out', 'exit', 'leave'],
        action: () => {
          // Handle logout
          console.log('Logging out');
        }
      }
    ];

    return [
      ...baseItems,
      ...(roleBasedItems[user?.role] || []),
      ...quickActions
    ];
  };

  // Search function - combines navigation items with real data
  const performSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // Get navigation/static items
      const searchableItems = getSearchableItems();
      const lowercaseQuery = query.toLowerCase();

      const navigationResults = searchableItems.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(lowercaseQuery);
        const descriptionMatch = item.description.toLowerCase().includes(lowercaseQuery);
        const keywordMatch = item.keywords.some(keyword => 
          keyword.toLowerCase().includes(lowercaseQuery)
        );
        const categoryMatch = item.category.toLowerCase().includes(lowercaseQuery);

        return titleMatch || descriptionMatch || keywordMatch || categoryMatch;
      });

      // Get real data results
      let dataResults = [];
      if (query.length >= 2) {
        try {
          const searchData = await searchAPI.globalSearch(query);
          
          // Combine all data results
          dataResults = [
            ...searchData.patients || [],
            ...searchData.appointments || [],
            ...searchData.doctors || [],
            ...searchData.clinics || []
          ];
        } catch (error) {
          console.error('Data search error:', error);
        }
      }

      // Combine and sort all results
      const allResults = [...navigationResults, ...dataResults];
      
      const sortedResults = allResults.sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.title.toLowerCase() === lowercaseQuery ? 3 : 0;
        const bExact = b.title.toLowerCase() === lowercaseQuery ? 3 : 0;
        
        // Then title matches
        const aTitle = a.title.toLowerCase().includes(lowercaseQuery) ? 2 : 0;
        const bTitle = b.title.toLowerCase().includes(lowercaseQuery) ? 2 : 0;
        
        // Then keyword matches
        const aKeyword = a.keywords?.some(k => k.toLowerCase().includes(lowercaseQuery)) ? 1 : 0;
        const bKeyword = b.keywords?.some(k => k.toLowerCase().includes(lowercaseQuery)) ? 1 : 0;
        
        return (bExact + bTitle + bKeyword) - (aExact + aTitle + aKeyword);
      });

      // Limit results and save search
      const limitedResults = sortedResults.slice(0, 20);
      setSearchResults(limitedResults);
      
      if (query.length >= 2) {
        searchAPI.saveRecentSearch(query);
      }
      
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search input
  const handleSearch = (query) => {
    setSearchQuery(query);
    performSearch(query);
  };

  // Navigate to search result
  const navigateToResult = (item) => {
    if (item.action) {
      item.action();
    } else if (item.path && item.path !== '#notifications' && item.path !== '#logout') {
      navigate(item.path);
    }
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      
      // Escape to close search
      if (e.key === 'Escape' && isSearchOpen) {
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const value = {
    searchQuery,
    searchResults,
    isSearchOpen,
    isLoading,
    setIsSearchOpen,
    handleSearch,
    navigateToResult,
    clearSearch,
    performSearch
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};
