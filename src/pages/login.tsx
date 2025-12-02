import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';

type LoginFormValues = {
  employeeId: string;
  password: string;
  rememberMe: boolean;
};

export default function Login() {
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const router = useRouter();
  const { login } = useAuth();
  const lockoutDurationMs = 30 * 1000; // 30 seconds temporary lock

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<LoginFormValues>({
    defaultValues: {
      employeeId: '',
      password: '',
      rememberMe: false
    }
  });

  const isLockedOut = useMemo(() => {
    if (!lockoutUntil) return false;
    return lockoutUntil.getTime() > Date.now();
  }, [lockoutUntil]);

  useEffect(() => {
    const savedId = localStorage.getItem('rememberedEmployeeId');
    if (savedId) {
      setValue('employeeId', savedId);
      setValue('rememberMe', true);
    }
  }, [setValue]);

  useEffect(() => {
    if (!lockoutUntil) return;
    const timer = setInterval(() => {
      if (lockoutUntil.getTime() <= Date.now()) {
        setLockoutUntil(null);
        setFailedAttempts(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const onSubmit = async (values: LoginFormValues) => {
    if (isLockedOut) {
      setAuthError('Too many failed attempts. Please wait a moment before trying again.');
      return;
    }

    try {
      setAuthError('');
      setIsLoading(true);
      const { success, error: loginError } = await login(values.employeeId, values.password);

      if (success) {
        if (values.rememberMe) {
          localStorage.setItem('rememberedEmployeeId', values.employeeId);
        } else {
          localStorage.removeItem('rememberedEmployeeId');
        }
        setFailedAttempts(0);
        setLockoutUntil(null);
        router.push('/');
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutUntil(new Date(Date.now() + lockoutDurationMs));
          setAuthError('Account temporarily locked due to multiple failed attempts. Please wait 30 seconds.');
        } else if (loginError) {
          setAuthError(loginError);
        } else {
          setAuthError('Invalid credentials. Please try again.');
        }
        reset({ employeeId: values.employeeId, password: '', rememberMe: values.rememberMe });
      }
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const remainingLockSeconds = useMemo(() => {
    if (!isLockedOut || !lockoutUntil) return 0;
    return Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000);
  }, [isLockedOut, lockoutUntil]);

  const employeeIdValue = watch('employeeId');

  return (
      <div className="min-h-screen bg-gray-50">
        {/* Simple Navigation Bar */}
        <div className="bg-indigo-600">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h1 className="text-white text-xl font-semibold">Attendance Login</h1>
              </div>
            </div>
          </div>
        </div>
        
        {/* Login Form Container */}
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow-md">
            <div>
              <h2 className="text-center text-2xl font-bold text-gray-900">
                Sign in to your account
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Enter your credentials to access the attendance system
              </p>
            </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {authError}
                  </h3>
                </div>
              </div>
            </div>
          )}

          {isLockedOut && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800">
                    Login temporarily disabled for security. Try again in {remainingLockSeconds}s.
                  </h3>
                </div>
              </div>
            </div>
          )}
        
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                Employee ID
              </label>
              <div className="mt-1">
                <input
                  {...register('employeeId', {
                    required: 'Employee ID is required',
                    maxLength: {
                      value: 20,
                      message: 'Maximum 20 characters'
                    }
                  })}
                  id="employeeId"
                  type="text"
                  autoComplete="username"
                  disabled={isLoading || isLockedOut}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="e.g. 1001 or admin"
                />
              </div>
              {errors.employeeId ? (
                <p className="mt-2 text-sm text-red-600">{errors.employeeId.message}</p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Demo credentials: admin / Admin@123 · 1001 / Alice@1001 · 1002 / Rahul@1002
                </p>
              )}
            </div>
          
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Minimum 6 characters'
                    }
                  })}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isLoading || isLockedOut}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              )}
              <p className="mt-2 text-sm text-gray-500">Use a strong password you do not share with others.</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('rememberMe')}
                  id="remember-me"
                  type="checkbox"
                  disabled={isLoading || isLockedOut}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || isLockedOut}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Security tips
                </h3>
                <div className="mt-1 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>System auto-signs you out after 30 minutes of inactivity.</li>
                    <li>Never share your Employee ID or password.</li>
                    <li>Contact admin if you suspect unauthorized access.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Attempts remaining before lockout: {Math.max(0, 5 - failedAttempts)}
            </p>
            {employeeIdValue && (
              <p className="mt-2 text-sm text-gray-600">
                Signing in as <strong>{employeeIdValue}</strong>
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
  );
}
