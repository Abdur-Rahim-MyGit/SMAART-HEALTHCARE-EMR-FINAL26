# Responsive Design Guide - All Screen Sizes

## Screen Size Breakpoints (Tailwind CSS)

- **Mobile (xs)**: < 640px (default, no prefix)
- **Small (sm)**: ≥ 640px
- **Medium (md)**: ≥ 768px (tablets)
- **Large (lg)**: ≥ 1024px (small desktops)
- **XL (xl)**: ≥ 1280px (desktops)
- **2XL (2xl)**: ≥ 1536px (large desktops)

## Responsive Design Patterns

### 1. Grid Layouts
```jsx
// Mobile: 1 column, Tablet: 2 columns, Desktop: 3-4 columns
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"

// Stats cards
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"

// Two column layouts
className="grid grid-cols-1 lg:grid-cols-2 gap-6"
```

### 2. Flex Layouts
```jsx
// Stack on mobile, row on desktop
className="flex flex-col md:flex-row gap-4"

// Responsive spacing
className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
```

### 3. Text Sizing
```jsx
// Headings
className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold"

// Body text
className="text-sm sm:text-base md:text-lg"

// Small text
className="text-xs sm:text-sm"
```

### 4. Padding & Spacing
```jsx
// Container padding
className="p-4 sm:p-6 md:p-8"

// Section spacing
className="space-y-4 sm:space-y-6 md:space-y-8"

// Gap in flex/grid
className="gap-3 sm:gap-4 md:gap-6"
```

### 5. Width & Max Width
```jsx
// Full width on mobile, constrained on desktop
className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"

// Modal/Card widths
className="w-full sm:w-auto sm:min-w-[500px] md:min-w-[600px] lg:min-w-[700px]"
```

### 6. Hide/Show Elements
```jsx
// Hide on mobile, show on desktop
className="hidden md:block"
className="hidden lg:flex"

// Show on mobile, hide on desktop
className="block md:hidden"
className="flex lg:hidden"
```

### 7. Tables
```jsx
// Responsive table wrapper
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>

// Alternative: Card view on mobile, table on desktop
<div className="block md:hidden">
  {/* Card layout for mobile */}
</div>
<div className="hidden md:block">
  {/* Table layout for desktop */}
</div>
```

### 8. Forms
```jsx
// Form grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"

// Input groups
className="flex flex-col sm:flex-row gap-3"

// Buttons
className="w-full sm:w-auto px-4 py-2"
```

### 9. Navigation
```jsx
// Mobile menu
className="lg:hidden" // Mobile menu button
className="hidden lg:flex" // Desktop navigation

// Sidebar
className="fixed lg:static w-64 transform lg:transform-none"
```

### 10. Images & Media
```jsx
// Responsive images
className="w-full h-48 sm:h-64 md:h-80 object-cover"

// Avatar sizes
className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16"
```

## Common Responsive Issues & Fixes

### Issue 1: Fixed widths breaking mobile
❌ Bad: `className="w-96"`
✅ Good: `className="w-full sm:w-96"`

### Issue 2: Text overflow on small screens
❌ Bad: No truncation
✅ Good: `className="truncate sm:text-clip"`

### Issue 3: Horizontal scroll on mobile
❌ Bad: No overflow handling
✅ Good: `className="overflow-x-auto"`

### Issue 4: Buttons too small on mobile
❌ Bad: `className="px-2 py-1 text-xs"`
✅ Good: `className="px-4 py-2 text-sm sm:px-3 sm:py-1.5 sm:text-xs"`

### Issue 5: Too many columns on mobile
❌ Bad: `className="grid grid-cols-4"`
✅ Good: `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"`

### Issue 6: Modal too wide on mobile
❌ Bad: `className="w-[800px]"`
✅ Good: `className="w-full max-w-[800px] mx-4"`

### Issue 7: Sidebar always visible on mobile
❌ Bad: Sidebar without mobile handling
✅ Good: Mobile overlay + transform for sidebar

### Issue 8: Search bar too wide
❌ Bad: `className="w-96"`
✅ Good: `className="w-full md:w-72 lg:w-96"`

## Component-Specific Patterns

### Dashboard Cards
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
  <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-4 sm:p-6">
    {/* Card content */}
  </div>
</div>
```

### Data Tables
```jsx
<div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
      {/* Table content */}
    </table>
  </div>
</div>
```

### Modals
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    {/* Modal content */}
  </div>
</div>
```

### Forms
```jsx
<form className="space-y-4 sm:space-y-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium mb-2">Label</label>
      <input className="w-full px-3 py-2 sm:px-4 sm:py-2.5" />
    </div>
  </div>
</form>
```

### Header
```jsx
<header className="sticky top-0 z-20 bg-white dark:bg-gray-950">
  <div className="px-4 sm:px-6 py-3">
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      {/* Header content */}
    </div>
  </div>
</header>
```

## Testing Checklist

- [ ] Test on mobile (320px - 640px)
- [ ] Test on tablet portrait (640px - 768px)
- [ ] Test on tablet landscape (768px - 1024px)
- [ ] Test on laptop (1024px - 1280px)
- [ ] Test on desktop (1280px - 1536px)
- [ ] Test on large desktop (1536px+)
- [ ] Test horizontal scrolling
- [ ] Test text overflow/truncation
- [ ] Test touch targets (min 44x44px)
- [ ] Test navigation on all sizes
- [ ] Test modals on all sizes
- [ ] Test forms on all sizes
- [ ] Test tables on mobile
- [ ] Test images/media scaling

## Priority Components to Fix

1. **Layout Components**
   - DashboardLayout
   - Header
   - Sidebar

2. **Dashboard Components**
   - ClinicDashboard
   - DoctorDashboard
   - NurseDashboard
   - PatientDashboard
   - SuperAdminDashboard
   - SuperMasterAdminDashboard

3. **Page Components**
   - PatientView
   - Settings
   - BillingInsurance
   - Appointments
   - Doctors/Nurses/Pharmacy Management

4. **Form Components**
   - PatientModal
   - All edit modals

5. **Table Components**
   - All data tables
