# MongoDB Setup Guide for EMR Healthcare System

## Prerequisites
1. **Install MongoDB Community Server**
   - Download from: https://www.mongodb.com/try/download/community
   - Follow installation instructions for Windows
   - Make sure MongoDB service is running

2. **Install MongoDB Compass (GUI)**
   - Download from: https://www.mongodb.com/try/download/compass
   - This provides a visual interface to view your database

## Quick Setup Steps

### 1. Copy Environment Configuration
```bash
# In the backend directory
copy .env.example .env
```

### 2. Edit .env file
Open `.env` and update if needed:
```
MONGODB_URI=mongodb://localhost:27017/emr_healthcare_db
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here_change_in_production
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed Database with Sample Data
```bash
npm run seed
```

### 5. Start the Backend Server
```bash
npm run dev
```

## MongoDB Compass Connection

### Connection String
```
mongodb://localhost:27017
```

### Database Name
```
emr_healthcare_db
```

### Collections Created
- `users` - System users (admin, doctors, nurses, patients)
- `clinics` - Healthcare facilities
- `patients` - Patient records and medical history
- `appointments` - Appointment scheduling and management
- `billings` - Billing and payment records

## Sample Login Credentials

After running `npm run seed`, you can use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@healthcareplus.com | admin123 |
| Doctor | dr.smith@healthcareplus.com | doctor123 |
| Nurse | nurse.johnson@healthcareplus.com | nurse123 |
| Patient | john.doe@email.com | patient123 |

## Troubleshooting

### MongoDB Not Running
```bash
# Windows - Start MongoDB service
net start MongoDB

# Or run mongod directly
mongod --dbpath "C:\data\db"
```

### Connection Issues
1. Check if MongoDB service is running
2. Verify connection string: `mongodb://localhost:27017`
3. Ensure port 27017 is not blocked
4. Check MongoDB logs for errors

### Compass Connection
1. Open MongoDB Compass
2. Use connection string: `mongodb://localhost:27017`
3. Click "Connect"
4. Navigate to `emr_healthcare_db` database

## API Endpoints

Base URL: `http://localhost:5000/api`

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/forgot-password` - Password reset

### Users
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Patients
- `GET /patients` - Get all patients
- `POST /patients` - Create new patient
- `GET /patients/:id` - Get patient by ID
- `PUT /patients/:id` - Update patient

### Appointments
- `GET /appointments` - Get all appointments
- `POST /appointments` - Create new appointment
- `PUT /appointments/:id` - Update appointment
- `DELETE /appointments/:id` - Cancel appointment

## Database Schema

### User Schema
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  role: ['super_master_admin', 'super_admin', 'doctor', 'nurse', 'billing_staff', 'pharmacy_staff', 'patient'],
  clinicId: ObjectId,
  specialization: String (for doctors),
  licenseNumber: String,
  isActive: Boolean,
  timestamps: true
}
```

### Patient Schema
```javascript
{
  patientId: String (auto-generated),
  userId: ObjectId,
  clinicId: ObjectId,
  dateOfBirth: Date,
  gender: ['male', 'female', 'other'],
  bloodType: String,
  emergencyContact: Object,
  medicalHistory: Array,
  allergies: Array,
  medications: Array,
  insuranceInfo: Object,
  timestamps: true
}
```

### Appointment Schema
```javascript
{
  appointmentId: String (auto-generated),
  patientId: ObjectId,
  doctorId: ObjectId,
  clinicId: ObjectId,
  appointmentDate: Date,
  timeSlot: { start: String, end: String },
  type: ['consultation', 'follow_up', 'emergency', 'routine_checkup'],
  status: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
  reason: String,
  notes: String,
  prescription: Object,
  vitals: Object,
  timestamps: true
}
```
