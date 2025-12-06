import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

export type User = {
  id: string;
  employeeId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'employee';
};

export type MockAccount = User & {
  password: string;
  email?: string;
  department?: string;
  joiningDate?: string;
  status?: 'active' | 'inactive';
};

type AuthContextType = {
  user: User | null;
  login: (employeeId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'authUser';
export const CUSTOM_ACCOUNTS_STORAGE_KEY = 'customEmployeeAccounts';

export const DEFAULT_ACCOUNTS: MockAccount[] = [
  {
    id: '1',
    employeeId: 'admin',
    name: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    password: 'Admin@123',
    email: 'admin@example.com',
    department: 'Operations',
    joiningDate: '2023-01-10'
  }
];

export const loadCustomAccounts = (): MockAccount[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(CUSTOM_ACCOUNTS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error('Failed to load custom accounts:', error);
    return [];
  }
};

export const getAllAccounts = async (): Promise<MockAccount[]> => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employees from Supabase:', error);
      return [];
    }

    // Map Supabase schema to MockAccount type
    return (data || []).map((emp: any) => ({
      id: emp.id,
      employeeId: emp.employee_id,
      name: emp.full_name,
      firstName: emp.first_name,
      lastName: emp.last_name,
      role: emp.role as 'admin' | 'employee',
      password: emp.password,
      email: emp.email,
      department: emp.department,
      joiningDate: emp.joining_date,
      status: emp.status as 'active' | 'inactive'
    }));
  } catch (error) {
    console.error('Unexpected error fetching employees:', error);
    return [];
  }
};

export const saveCustomAccounts = (accounts: MockAccount[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
};

export const upsertCustomAccount = async (account: MockAccount): Promise<void> => {
  try {
    // Normalize employee_id to lowercase for consistent querying
    const normalizedEmployeeId = account.employeeId.trim().toLowerCase();

    // Check if employee exists by employee_id
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_id', normalizedEmployeeId)
      .single();

    const employeeData = {
      employee_id: normalizedEmployeeId,  // Store in lowercase
      first_name: account.firstName || '',
      last_name: account.lastName || '',
      full_name: account.name,
      role: account.role,
      department: account.department || null,
      email: account.email || null,
      joining_date: account.joiningDate || null,
      status: account.status || 'active',
      password: account.password
    };

    if (existing) {
      // Update existing employee
      const { error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new employee
      const { error } = await supabase
        .from('employees')
        .insert([employeeData]);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error upserting employee:', error);
    throw error;
  }
};

export const removeCustomAccounts = async (employeeIds: string[]): Promise<void> => {
  if (employeeIds.length === 0) return;

  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .in('id', employeeIds);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting employees:', error);
    throw error;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to restore auth session:', error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (employeeId: string, password: string) => {
    try {
      const normalizedId = employeeId.trim().toLowerCase();

      // Query Supabase for the employee (case-insensitive)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', normalizedId)
        .single();

      if (error || !data) {
        console.log('Employee not found:', normalizedId, 'Error:', error);
        return {
          success: false,
          error: 'Employee ID not found. Please check with your administrator.'
        };
      }

      console.log('Found account:', data);
      console.log('Password check - provided:', password, 'stored:', data.password);

      if (data.password !== password) {
        return {
          success: false,
          error: 'Incorrect password. Please try again.'
        };
      }

      const authenticatedUser: User = {
        id: data.id,
        employeeId: data.employee_id,
        name: data.full_name,
        role: data.role as 'admin' | 'employee'
      };

      setUser(authenticatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Invalid credentials. Please try again.'
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
