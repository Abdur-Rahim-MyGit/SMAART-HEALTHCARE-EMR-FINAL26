# EMR Backend API Documentation

## Overview
This is the comprehensive backend API for the EMR Healthcare Management System. It provides RESTful endpoints for managing doctors, patients, appointments, consultations, referrals, invoices, and dashboard analytics.

## Base URL
```
http://localhost:5001/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Health Check
- **GET** `/health` - Check API health status

### Authentication
- **POST** `/auth/register` - Register new user
- **POST** `/auth/login` - User login
- **POST** `/auth/logout` - User logout

### Doctors
- **GET** `/doctors` - Get all doctors (with pagination, search, filters)
- **GET** `/doctors/:id` - Get doctor by ID
- **POST** `/doctors` - Create new doctor
- **PUT** `/doctors/:id` - Update doctor
- **DELETE** `/doctors/:id` - Deactivate doctor
- **GET** `/doctors/stats/overview` - Get doctor statistics

### Patients
- **GET** `/patients` - Get all patients
- **GET** `/patients/:id` - Get patient by ID
- **POST** `/patients` - Create new patient
- **PUT** `/patients/:id` - Update patient

### Appointments
- **GET** `/appointments` - Get all appointments
- **GET** `/appointments/:id` - Get appointment by ID
- **POST** `/appointments` - Create new appointment
- **PUT** `/appointments/:id` - Update appointment
- **PUT** `/appointments/:id/status` - Update appointment status

### Consultations
- **GET** `/consultations` - Get all consultations
- **GET** `/consultations/:id` - Get consultation by ID
- **POST** `/consultations` - Create new consultation
- **PUT** `/consultations/:id` - Update consultation
- **POST** `/consultations/:id/prescriptions` - Add prescription
- **POST** `/consultations/:id/lab-tests` - Add lab test
- **PUT** `/consultations/:id/status` - Update consultation status
- **GET** `/consultations/stats/overview` - Get consultation statistics

### Referrals
- **GET** `/referrals` - Get all referrals
- **GET** `/referrals/:id` - Get referral by ID
- **POST** `/referrals` - Create new referral
- **PUT** `/referrals/:id` - Update referral
- **PUT** `/referrals/:id/status` - Update referral status
- **PUT** `/referrals/:id/urgency` - Update referral urgency
- **GET** `/referrals/urgent` - Get urgent referrals
- **GET** `/referrals/overdue` - Get overdue referrals
- **GET** `/referrals/stats/overview` - Get referral statistics

### Invoices
- **GET** `/invoices` - Get all invoices
- **GET** `/invoices/:id` - Get invoice by ID
- **POST** `/invoices` - Create new invoice
- **PUT** `/invoices/:id` - Update invoice
- **PUT** `/invoices/:id/status` - Update invoice status
- **POST** `/invoices/:id/payments` - Add partial payment
- **GET** `/invoices/overdue` - Get overdue invoices
- **GET** `/invoices/stats/overview` - Get invoice statistics

### Dashboard
- **GET** `/dashboard/overview` - Get dashboard overview statistics
- **GET** `/dashboard/recent-activity` - Get recent activity
- **GET** `/dashboard/analytics` - Get analytics data for charts
- **GET** `/dashboard/system-health` - Get system health metrics
- **GET** `/dashboard/alerts` - Get system alerts and notifications

## Query Parameters

### Pagination
Most list endpoints support pagination:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

### Filtering
- `status` - Filter by status
- `search` - Search in relevant fields
- `startDate` / `endDate` - Date range filtering

### Example Requests

#### Get Doctors with Filters
```http
GET /api/doctors?page=1&limit=10&specialty=Cardiology&status=active&search=Johnson
```

#### Create New Appointment
```http
POST /api/appointments
Content-Type: application/json
Authorization: Bearer <token>

{
  "patientId": "64f7b1234567890123456789",
  "patientName": "John Smith",
  "type": "Consultation",
  "date": "2024-01-15",
  "time": "10:00",
  "duration": 30,
  "provider": "Dr. Sarah Johnson",
  "reason": "Regular checkup"
}
```

#### Update Consultation Status
```http
PUT /api/consultations/64f7b1234567890123456789/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "Completed"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Data Models

### Doctor
```json
{
  "_id": "ObjectId",
  "fullName": "string",
  "email": "string",
  "specialty": "string",
  "phone": "string",
  "role": "doctor|admin",
  "isActive": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Patient
```json
{
  "_id": "ObjectId",
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "dateOfBirth": "Date",
  "gender": "Male|Female|Other",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string"
  },
  "emergencyContact": {
    "name": "string",
    "relationship": "string",
    "phone": "string"
  },
  "insurance": {
    "provider": "string",
    "policyNumber": "string",
    "groupNumber": "string"
  },
  "medicalHistory": {
    "allergies": ["string"],
    "chronicConditions": ["string"],
    "currentMedications": ["string"],
    "surgicalHistory": ["string"]
  },
  "status": "Active|Inactive",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Appointment
```json
{
  "_id": "ObjectId",
  "patientId": "ObjectId",
  "patientName": "string",
  "type": "Consultation|Follow-up|Check-up|Procedure",
  "date": "Date",
  "time": "string",
  "duration": "number",
  "status": "Scheduled|Confirmed|In Progress|Completed|Cancelled|No Show",
  "priority": "Low|Medium|High",
  "location": "string",
  "provider": "string",
  "notes": "string",
  "reason": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## Environment Variables
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/emr_healthcare_db
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env` file

3. Start MongoDB service

4. Seed the database with sample data:
   ```bash
   npm run seed
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

## Sample Login Credentials

After running the seed script, you can use these credentials:

**Doctor Login:**
- Email: `sarah.johnson@hospital.com`
- Password: `password123`

All seeded doctors use the same password: `password123`

## Error Handling

The API includes comprehensive error handling with:
- Input validation using express-validator
- MongoDB error handling
- JWT authentication errors
- Custom business logic errors

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Role-based access control
