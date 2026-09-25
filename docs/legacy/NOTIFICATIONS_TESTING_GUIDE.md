# Notifications System Testing Guide

## ✅ What Was Implemented

### 1. **Notifications API** (`frontend/src/services/api.js`)
- Fetches data from 5 modules: Appointments, Patients, Referrals, Billing, Consultations
- Aggregates and sorts by most recent
- Returns formatted notifications with colors and timestamps

### 2. **Header Component Updates** (`frontend/src/components/layout/Header.jsx`)
- Real-time notification fetching
- Auto-refresh every 30 seconds
- Dynamic notification badge
- Dropdown with recent notifications
- "View All" modal for detailed view

## 🧪 How to Test

### Step 1: Check Browser Console
1. Open your browser DevTools (F12)
2. Go to Console tab
3. Look for these messages:
   - `🔔 Fetching notifications...`
   - `📬 Notifications fetched: X`
   - `✅ Notifications set: X`

### Step 2: Check Network Tab
1. Open DevTools Network tab
2. Filter by "XHR" or "Fetch"
3. Look for these API calls:
   - `/api/appointments`
   - `/api/patients`
   - `/api/referrals`
   - `/api/billing`
   - `/api/consultations`

### Step 3: Test Notification Bell
1. Click the bell icon in header
2. Should see:
   - Loading spinner (briefly)
   - List of notifications OR "No notifications"
   - Badge with count (if notifications exist)

### Step 4: Test "View All" Modal
1. Click "View all notifications" button
2. Should open a modal with:
   - All notifications in cards
   - Full message text
   - Type badges
   - Time ago
   - Close button

## 🐛 Troubleshooting

### If No Notifications Appear:

**Check 1: Backend Running?**
```bash
cd backend
npm run dev
```

**Check 2: Database Has Data?**
- Make sure you have appointments, patients, referrals, billing, or consultations in your database

**Check 3: Console Errors?**
- Look for red errors in browser console
- Check if API calls are failing (401, 404, 500 errors)

**Check 4: Authentication?**
- Make sure you're logged in
- Check if token is valid

### Common Issues:

1. **"Cannot read property 'data' of undefined"**
   - API response format doesn't match expected structure
   - Check backend response format

2. **"Network Error"**
   - Backend not running
   - CORS issues
   - Wrong API URL

3. **Empty notifications array**
   - No data in database
   - API filters excluding all data
   - Check console logs for API responses

## 📊 Expected Data Structure

### Notification Object:
```javascript
{
  id: "apt-123abc",
  type: "appointment",
  title: "New Appointment",
  message: "John Doe - General Consultation",
  time: "2025-11-09T10:30:00.000Z",
  color: "blue",
  data: { /* original appointment object */ }
}
```

### Notification Types:
- **appointment** (blue) - New appointments
- **patient** (green) - New patient registrations
- **referral** (purple) - New referrals
- **billing** (orange) - New billing records
- **consultation** (teal) - Completed consultations

## 🔍 Debug Commands

### Check if notificationsAPI exists:
```javascript
// In browser console
import { notificationsAPI } from './services/api'
console.log(notificationsAPI)
```

### Manually fetch notifications:
```javascript
// In browser console (if you have access to the API)
fetch('http://localhost:5001/api/appointments', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(r => r.json())
.then(console.log)
```

## 📝 Console Logs to Look For

### Success Flow:
```
🔔 Fetching notifications...
📬 Notifications fetched: 5
📬 Sample notification: {id: "apt-...", type: "appointment", ...}
🔔 Notifications response: {success: true, data: [...]}
✅ Notifications set: 5
```

### Error Flow:
```
🔔 Fetching notifications...
❌ Error fetching notifications: [error message]
```

## 🎯 Next Steps

1. **Refresh the page** - The notifications should load automatically
2. **Check console** - Look for the emoji logs
3. **Click bell icon** - Test the dropdown
4. **Click "View all"** - Test the modal
5. **Wait 30 seconds** - Notifications should auto-refresh

## 💡 Tips

- Notifications fetch on page load
- Auto-refresh every 30 seconds
- Badge shows count (max 9+)
- Modal shows full details
- All features work in dark mode

## 🚀 If Everything Works:

You should see:
- ✅ Bell icon with badge count
- ✅ Dropdown with recent notifications
- ✅ "View all" button opens modal
- ✅ Console logs showing successful fetches
- ✅ Auto-refresh every 30 seconds

## 📞 Still Not Working?

Share these details:
1. Console error messages
2. Network tab screenshot
3. Backend console output
4. Browser and version
