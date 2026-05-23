import React, { useEffect, useRef, useState } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import { 
  Search, 
  ArrowRight, 
  Clock, 
  Command, 
  Loader2,
  Calendar,
  Users,
  Settings,
  Bell,
  LayoutDashboard,
  Building2,
  Stethoscope,
  UserCheck,
  ArrowRightLeft,
  BarChart3,
  CreditCard,
  Pill,
  HelpCircle,
  FileText,
  LogOut,
  X
} from 'lucide-react';

const SearchResults = () => {
  const { 
    searchQuery, 
    searchResults, 
    isSearchOpen, 
    isLoading, 
    setIsSearchOpen, 
    handleSearch, 
    navigateToResult, 
    clearSearch 
  } = useSearch();
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Icon mapping for different categories and items
  const getIcon = (item) => {
    const iconMap = {
      // Navigation
      'dashboard': LayoutDashboard,
      
      // Management
      'clinics': Building2,
      'clinic': Building2,
      
      // Patients & Medical
      'patients': Users,
      'patient': Users,
      'appointments': Calendar,
      'appointment': Calendar,
      'doctors': Stethoscope,
      'doctor': Stethoscope,
      'nurses': UserCheck,
      'nurse': UserCheck,
      'referrals': ArrowRightLeft,
      'referral': ArrowRightLeft,
      
      // System & Settings
      'settings': Settings,
      'reports': BarChart3,
      'analytics': BarChart3,
      
      // Financial
      'billing': CreditCard,
      'insurance': CreditCard,
      
      // Pharmacy
      'pharmacy': Pill,
      'medications': Pill,
      
      // Support & Help
      'support': HelpCircle,
      'help': HelpCircle,
      
      // Quick Actions
      'notifications': Bell,
      'profile': Users,
      'logout': LogOut,
      
      // Documents
      'reports': FileText,
      'medical reports': FileText
    };

    // Try to find icon by item id first
    if (iconMap[item.id]) {
      return iconMap[item.id];
    }

    // Try to find icon by title keywords
    const title = item.title.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (title.includes(key)) {
        return icon;
      }
    }

    // Default icon based on category
    switch (item.category) {
      case 'Navigation': return LayoutDashboard;
      case 'Management': return Building2;
      case 'Patients': return Users;
      case 'Scheduling': return Calendar;
      case 'Staff': return UserCheck;
      case 'Medical': return Stethoscope;
      case 'Analytics': return BarChart3;
      case 'Financial': return CreditCard;
      case 'Pharmacy': return Pill;
      case 'Support': return HelpCircle;
      case 'System': return Settings;
      case 'Quick Actions': return ArrowRight;
      case 'Personal': return Users;
      default: return Search;
    }
  };

  // Category colors
  const getCategoryColor = (category) => {
    const colorMap = {
      'Navigation': 'bg-blue-100 text-blue-700',
      'Management': 'bg-purple-100 text-purple-700',
      'Patients': 'bg-green-100 text-green-700',
      'Scheduling': 'bg-orange-100 text-orange-700',
      'Staff': 'bg-indigo-100 text-indigo-700',
      'Medical': 'bg-red-100 text-red-700',
      'Analytics': 'bg-yellow-100 text-yellow-700',
      'Financial': 'bg-emerald-100 text-emerald-700',
      'Pharmacy': 'bg-pink-100 text-pink-700',
      'Support': 'bg-gray-100 text-gray-700',
      'System': 'bg-slate-100 text-slate-700',
      'Quick Actions': 'bg-cyan-100 text-cyan-700',
      'Personal': 'bg-teal-100 text-teal-700'
    };
    return colorMap[category] || 'bg-gray-100 text-gray-700';
  };

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isSearchOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            navigateToResult(searchResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearSearch();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, searchResults, selectedIndex, navigateToResult, clearSearch]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  if (!isSearchOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
      onClick={clearSearch}
    >
      <div 
        className="flex items-start justify-center pt-[10vh] px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center px-4 py-4 border-b border-gray-100">
            <Search className="h-5 w-5 text-gray-400 mr-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for appointments, patients, settings..."
              className="flex-1 outline-none text-lg placeholder-gray-400"
            />
            {isLoading && (
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin ml-3" />
            )}
            <div className="hidden sm:flex items-center gap-1 ml-3 text-xs text-gray-400">
              <Command className="h-3 w-3" />
              <span>K</span>
            </div>
            <button
              onClick={clearSearch}
              className="ml-3 p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
              title="Close search"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto" ref={resultsRef}>
            {searchQuery && !isLoading && searchResults.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No results found for "{searchQuery}"</p>
                <p className="text-xs text-gray-400 mt-1">
                  Try searching for appointments, patients, settings, or notifications
                </p>
              </div>
            )}

            {!searchQuery && !isLoading && (
              <div className="px-4 py-8 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">Quick Search</p>
                <p className="text-xs text-gray-400 mt-1">
                  Search for pages, features, and actions
                </p>
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
                  <Command className="h-3 w-3" />
                  <span>K to open • ↑↓ to navigate • ↵ to select • esc to close</span>
                </div>
              </div>
            )}

            {searchResults.map((result, index) => {
              const Icon = getIcon(result);
              const isSelected = index === selectedIndex;
              
              return (
                <div
                  key={result.id}
                  onClick={() => navigateToResult(result)}
                  className={`flex items-center px-4 py-3 cursor-pointer transition-all duration-150 ${
                    isSelected 
                      ? 'bg-primary-50 border-r-2 border-primary-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg mr-3 ${
                    isSelected ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      isSelected ? 'text-primary-600' : 'text-gray-600'
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium text-sm truncate ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {result.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(result.category)}`}>
                        {result.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {result.description}
                    </p>
                  </div>
                  
                  <ArrowRight className={`h-4 w-4 ml-3 ${
                    isSelected ? 'text-primary-500' : 'text-gray-400'
                  }`} />
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {(searchResults.length > 0 || searchQuery) && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="font-mono bg-white border border-gray-200 rounded px-1">↑↓</span>
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono bg-white border border-gray-200 rounded px-1">↵</span>
                    <span>Select</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono bg-white border border-gray-200 rounded px-1">esc</span>
                    <span>Close</span>
                  </div>
                </div>
                {searchResults.length > 0 && (
                  <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResults;
