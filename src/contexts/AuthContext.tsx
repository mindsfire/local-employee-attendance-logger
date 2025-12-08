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
    // Query users_profile and join with admin_profile
    const { data, error } = await supabase
      .schema('shared')
      .from('users_profile')
      .select(`
        *,
        admin_profile!inner(role, password)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employees from Supabase:', error);
      return [];
    }

    // Map Supabase schema to MockAccount type
    return (data || []).map((user: any) => ({
      id: user.id,
      employeeId: user.employee_id,
      name: user.full_name,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.admin_profile?.role || 'employee',
      password: user.admin_profile?.password || '',
      email: user.email,
      department: user.department,
      joiningDate: user.joining_date,
      status: user.status as 'active' | 'inactive'
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
    const normalizedEmployeeId = account.employeeId.trim().toLowerCase();

    // Check if user exists
    const { data: existing } = await supabase
      .schema('shared')
      .from('users_profile')
      .select('id')
      .eq('employee_id', normalizedEmployeeId)
      .single();

    const userData = {
      employee_id: normalizedEmployeeId,
      first_name: account.firstName || '',
      last_name: account.lastName || '',
      full_name: account.name,
      email: account.email || null,
      department: account.department || null,
      joining_date: account.joiningDate || null,
      status: account.status || 'active'
    };

    let userId = existing?.id;

    if (existing) {
      // Update existing user
      const { error } = await supabase
        .schema('shared')
        .from('users_profile')
        .update(userData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new user
      const { data: newUser, error } = await supabase
        .schema('shared')
        .from('users_profile')
        .insert([userData])
        .select()
        .single();

      if (error) throw error;
      userId = newUser.id;
    }

    // Upsert admin_profile
    const { error: adminError } = await supabase
      .schema('shared')
      .from('admin_profile')
      .upsert({
        user_id: userId,
        role: account.role,
        password: account.password
      }, {
        onConflict: 'user_id'
      });

    if (adminError) throw adminError;
  } catch (error) {
    console.error('Error upserting employee:', error);
    throw error;
  }
};

export const removeCustomAccounts = async (employeeIds: string[]): Promise<void> => {
  if (employeeIds.length === 0) return;

  try {
    // Delete from users_profile (cascade will delete admin_profile)
    const { error } = await supabase
      .schema('shared')
      .from('users_profile')
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

      // Query user and admin profile
      const { data, error } = await supabase
        .schema('shared')
        .from('users_profile')
        .select(`
          *,
          admin_profile!inner(role, password)
        `)
        .eq('employee_id', normalizedId)
        .single();

      if (error || !data) {
        console.log('Employee not found:', normalizedId, 'Error:', error);
        return {
          success: false,
          error: 'Employee ID not found. Please check with your administrator.'
        };
      }

      const storedPassword = data.admin_profile?.password;

      if (!storedPassword || storedPassword !== password) {
        return {
          success: false,
          error: 'Incorrect password. Please try again.'
        };
      }

      const authenticatedUser: User = {
        id: data.id,
        employeeId: data.employee_id,
        name: data.full_name,
        role: data.admin_profile?.role || 'employee'
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
