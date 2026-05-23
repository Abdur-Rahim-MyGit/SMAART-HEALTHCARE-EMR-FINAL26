import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { Heart, User, Mail, Lock, Phone, UserCheck } from 'lucide-react'
import { authAPI } from '../../services/api'

const Register = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm()

  const watchRole = watch('role')

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await authAPI.register(data)
      if (response.data.success) {
        toast.success('Registration successful! Please verify your email.')
        navigate('/verify-otp', { state: { userId: response.data.userId, email: data.email } })
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Heart className="h-12 w-12 text-primary-500" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Join our EMR healthcare system
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  <User className="inline w-4 h-4 mr-2" />
                  First Name
                </label>
                <input
                  {...register('firstName', { required: 'First name is required' })}
                  type="text"
                  className="form-input"
                  placeholder="First name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="form-label">Last Name</label>
                <input
                  {...register('lastName', { required: 'Last name is required' })}
                  type="text"
                  className="form-input"
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="form-label">
                <Mail className="inline w-4 h-4 mr-2" />
                Email Address
              </label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                type="email"
                className="form-input"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">
                <Phone className="inline w-4 h-4 mr-2" />
                Phone Number
              </label>
              <input
                {...register('phone', { required: 'Phone number is required' })}
                type="tel"
                className="form-input"
                placeholder="Enter your phone number"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">
                <UserCheck className="inline w-4 h-4 mr-2" />
                Role
              </label>
              <select
                {...register('role', { required: 'Role is required' })}
                className="form-input"
              >
                <option value="">Select your role</option>
                <option value="super_master_admin">Super Master Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="billing_staff">Billing Staff</option>
                <option value="pharmacy_staff">Pharmacy Staff</option>
                <option value="patient">Patient</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            {watchRole === 'doctor' && (
              <>
                <div>
                  <label className="form-label">Specialization</label>
                  <input
                    {...register('specialization', { required: 'Specialization is required for doctors' })}
                    type="text"
                    className="form-input"
                    placeholder="e.g. Cardiology, Neurology"
                  />
                  {errors.specialization && (
                    <p className="mt-1 text-sm text-red-600">{errors.specialization.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">License Number</label>
                  <input
                    {...register('licenseNumber', { required: 'License number is required for doctors' })}
                    type="text"
                    className="form-input"
                    placeholder="Medical license number"
                  />
                  {errors.licenseNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.licenseNumber.message}</p>
                  )}
                </div>
              </>
            )}

            {watchRole === 'patient' && (
              <>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input
                    {...register('dateOfBirth', { required: 'Date of birth is required for patients' })}
                    type="date"
                    className="form-input"
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Gender</label>
                  <select
                    {...register('gender', { required: 'Gender is required for patients' })}
                    className="form-input"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="form-label">
                <Lock className="inline w-4 h-4 mr-2" />
                Password
              </label>
              <input
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
                type="password"
                className="form-input"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex justify-center items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                'Create Account'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Register