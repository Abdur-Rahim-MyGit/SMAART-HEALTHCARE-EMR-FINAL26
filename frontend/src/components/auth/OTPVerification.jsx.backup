import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { Heart, Shield } from 'lucide-react'
import { authAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

const OTPVerification = () => {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const { userId, email } = location.state || {}
  
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await authAPI.verifyOTP({
        userId,
        otp: data.otp
      })
      
      if (response.data.success) {
        login(response.data.user, response.data.token)
        toast.success('Email verified successfully!')
        navigate('/')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (!userId || !email) {
    navigate('/register')
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="relative">
              <Heart className="h-12 w-12 text-primary-500" />
              <Shield className="h-6 w-6 text-primary-600 absolute -bottom-1 -right-1" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Verify Your Email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We've sent a 6-digit code to <br />
            <span className="font-medium text-gray-900">{email}</span>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="form-label">
              Verification Code
            </label>
            <input
              {...register('otp', {
                required: 'OTP is required',
                pattern: {
                  value: /^\d{6}$/,
                  message: 'OTP must be 6 digits'
                }
              })}
              type="text"
              className="form-input text-center text-2xl tracking-widest"
              placeholder="123456"
              maxLength={6}
            />
            {errors.otp && (
              <p className="mt-1 text-sm text-red-600">{errors.otp.message}</p>
            )}
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
                'Verify Email'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Didn't receive the code?{' '}
              <button
                type="button"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Resend Code
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default OTPVerification