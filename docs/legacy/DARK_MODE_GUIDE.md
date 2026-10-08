# Dark Mode Implementation Guide

## ✅ Completed Components

### Settings Page (`frontend/src/components/pages/Settings.jsx`)
**Status:** ✅ Fully implemented with dark mode support

All sections have been updated with comprehensive dark mode classes:
- Profile Settings
- User Management Table
- General Settings
- Security Settings  
- Notifications Settings
- System Settings
- Database Settings
- Integration Settings
- Edit User Modal

---

## 🎨 Dark Mode Class Reference

### Text Colors

```jsx
// Primary Headings (h1, h2, h3)
className="text-gray-900 dark:text-white"

// Secondary Headings (h4, h5)
className="text-gray-900 dark:text-gray-100"

// Labels
className="text-gray-700 dark:text-gray-300"

// Body Text
className="text-gray-600 dark:text-gray-400"

// Muted/Secondary Text
className="text-gray-500 dark:text-gray-400"

// Placeholder Text
className="placeholder-gray-400 dark:placeholder-gray-500"
```

### Background Colors

```jsx
// Main Containers/Cards
className="bg-white dark:bg-gray-800"

// Secondary Containers/Sections
className="bg-gray-50 dark:bg-gray-700"

// Tertiary Backgrounds
className="bg-gray-100 dark:bg-gray-600"

// Input Fields
className="bg-white dark:bg-gray-700"

// Hover States
className="hover:bg-gray-50 dark:hover:bg-gray-700"
```

### Borders

```jsx
// Main Borders
className="border-gray-200 dark:border-gray-700"

// Input Borders
className="border-gray-300 dark:border-gray-600"

// Dividers
className="divide-gray-200 dark:divide-gray-700"
```

### Form Elements

```jsx
// Input Fields
className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"

// Select Dropdowns
className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all dark:bg-gray-700 dark:text-white"

// Textarea
className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all dark:bg-gray-700 dark:text-white"

// Checkboxes
className="h-4 w-4 text-[#004D99] focus:ring-[#004D99] border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"

// Labels for Checkboxes
className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
```

### Tables

```jsx
// Table Container
className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"

// Table
className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"

// Table Header
className="bg-gray-50 dark:bg-gray-700"

// Table Header Cells
className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"

// Table Body
className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"

// Table Rows (with hover)
className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"

// Table Cells - Primary Text
className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"

// Table Cells - Secondary Text
className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
```

### Modals

```jsx
// Modal Overlay
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"

// Modal Container
className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4"

// Modal Header
className="text-lg font-semibold text-gray-900 dark:text-white mb-4"

// Modal Close Button
className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
```

### Buttons

```jsx
// Primary Button
className="bg-[#004D99] text-white px-4 py-2 rounded-lg hover:bg-[#003d80] transition-colors"

// Secondary Button  
className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"

// Icon Button
className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
```

### Cards

```jsx
// Standard Card
className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6"

// Card with Gradient Background
className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 p-6 rounded-lg"
```

---

## 📋 Step-by-Step Implementation Process

### For Each Component:

1. **Identify All Text Elements**
   - Headings (h1-h6)
   - Paragraphs
   - Labels
   - Spans

2. **Update Background Elements**
   - Main containers
   - Cards
   - Sections
   - Input fields

3. **Fix Border Colors**
   - Container borders
   - Input borders
   - Dividers

4. **Update Interactive Elements**
   - Buttons
   - Links
   - Hover states
   - Focus states

5. **Test Thoroughly**
   - Toggle dark mode
   - Check all sections
   - Verify readability
   - Test interactive elements

---

## 🚀 Priority Components to Update

### High Priority (User-Facing Pages)
1. ✅ Settings Page - **COMPLETED**
2. ⏳ Patients Page (`frontend/src/components/patients/Patients.jsx`)
3. ⏳ Appointments Page (`frontend/src/components/appointments/Appointments.jsx`)
4. ⏳ Doctors Management (`frontend/src/components/pages/DoctorsManagement.jsx`)

### Medium Priority (Dashboards)
1. ⏳ SuperMasterAdminDashboard
2. ⏳ SuperAdminDashboard
3. ⏳ DoctorDashboard
4. ⏳ NurseDashboard
5. ⏳ ClinicDashboard

### Lower Priority (Admin Pages)
1. ⏳ Clinics Management
2. ⏳ Users Management
3. ⏳ Billing & Insurance
4. ⏳ Reports & Analytics

---

## 🔧 Quick Find & Replace Patterns

Use these patterns in your IDE for bulk updates:

### Pattern 1: Basic Text
```
Find: className="([^"]*text-gray-900[^"]*)"
Replace: className="$1 dark:text-white"
```

### Pattern 2: Labels
```
Find: className="([^"]*text-gray-700[^"]*)"
Replace: className="$1 dark:text-gray-300"
```

### Pattern 3: Backgrounds
```
Find: className="([^"]*bg-white[^"]*)"
Replace: className="$1 dark:bg-gray-800"
```

### Pattern 4: Borders
```
Find: className="([^"]*border-gray-200[^"]*)"
Replace: className="$1 dark:border-gray-700"
```

**⚠️ Warning:** Always review changes after bulk find/replace to ensure proper context!

---

## 💡 Tips & Best Practices

1. **Use Tailwind's Dark Mode Classes**
   - Always use `dark:` prefix for dark mode styles
   - Tailwind automatically handles the switching based on the `dark` class on `<html>`

2. **Maintain Contrast Ratios**
   - Ensure text is readable in both modes
   - Use lighter grays for dark mode text
   - Test with actual users

3. **Consistent Color Palette**
   - Stick to the defined color scheme
   - Use gray-800 for main dark backgrounds
   - Use gray-700 for secondary dark backgrounds
   - Use gray-600 for tertiary dark backgrounds

4. **Icons and SVGs**
   - Update icon colors: `text-gray-500 dark:text-gray-400`
   - Ensure icons are visible in both modes

5. **Charts and Graphs**
   - Update Recharts tooltip backgrounds
   - Adjust axis colors for dark mode
   - Update grid colors

6. **Images and Logos**
   - Consider providing dark mode variants
   - Adjust opacity if needed

---

## 🧪 Testing Checklist

- [ ] Toggle dark mode button works
- [ ] All text is readable
- [ ] No white text on white background
- [ ] No dark text on dark background
- [ ] Forms are usable
- [ ] Tables are readable
- [ ] Modals display correctly
- [ ] Buttons have proper contrast
- [ ] Hover states work
- [ ] Focus states are visible
- [ ] Charts/graphs are visible
- [ ] Icons are visible

---

## 📝 Example Component Update

### Before:
```jsx
<div className="bg-white rounded-lg p-6">
  <h2 className="text-2xl font-bold text-gray-900">Title</h2>
  <p className="text-gray-600">Description text</p>
  <input 
    type="text"
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  />
</div>
```

### After:
```jsx
<div className="bg-white dark:bg-gray-800 rounded-lg p-6">
  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Title</h2>
  <p className="text-gray-600 dark:text-gray-400">Description text</p>
  <input 
    type="text"
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
  />
</div>
```

---

## 🎯 Current Status

**Completed:** 1 component (Settings Page)
**In Progress:** 0 components
**Remaining:** ~40+ components

**Estimated Time per Component:**
- Small component (< 200 lines): 15-30 minutes
- Medium component (200-500 lines): 30-60 minutes
- Large component (500+ lines): 1-2 hours

---

## 📞 Need Help?

If you encounter any issues:
1. Check this guide for the correct class patterns
2. Test the Settings page to see working examples
3. Ensure ThemeContext is properly imported
4. Verify the `dark` class is being applied to `<html>` element

---

**Last Updated:** 2025-11-09
**Version:** 1.0
