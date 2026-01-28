import { auth } from '@/config/firebase';
import { CreateUserData, LoginCredentials, User } from '@/models/User';
import { AuthService } from '@/services/authService';
import { UserService } from '@/services/userService';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: CreateUserData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetPasswordByCardNumber: (cardNumber: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);
        setFirebaseUser(firebaseUser);

        if (firebaseUser) {
          // Fetch user data from Firestore
          const userData = await UserService.getUserByAuthUid(firebaseUser.uid);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error in auth state change:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      const firebaseUser = await AuthService.login(credentials);
      
      // Fetch user data from Firestore
      const userData = await UserService.getUserByAuthUid(firebaseUser.uid);
      
      if (!userData) {
        throw new Error('User profile not found');
      }

      if (!userData.isActive) {
        await AuthService.logout();
        throw new Error('Your account has been deactivated');
      }

      if (!userData.isApproved) {
        await AuthService.logout();
        throw new Error('Your account is pending approval');
      }

      setUser(userData);
      setFirebaseUser(firebaseUser);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: CreateUserData) => {
    let firebaseUser: FirebaseUser | null = null;
    
    try {
      setLoading(true);
      setError(null);

      // Step 1: Create Firebase auth user
      firebaseUser = await AuthService.register(userData);

      // Step 2: Create user document in Firestore
      // If this fails, we need to rollback the auth user creation
      const { password, ...userDataWithoutPassword } = userData;
      const newUser = await UserService.createUser(firebaseUser.uid, userDataWithoutPassword);

      // Both operations succeeded
      setUser(newUser);
      setFirebaseUser(firebaseUser);
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Rollback: If we created an auth user but Firestore failed, delete the auth user
      if (firebaseUser) {
        try {
          console.log('Rolling back Firebase Auth user creation...');
          await firebaseUser.delete();
          console.log('Firebase Auth user deleted successfully');
        } catch (deleteErr: any) {
          console.error('Failed to rollback auth user:', deleteErr);
          // If user is still logged in, sign them out
          try {
            await AuthService.logout();
          } catch (logoutErr) {
            console.error('Failed to logout after rollback:', logoutErr);
          }
        }
      }
      
      setError(err.message || 'Failed to register');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.logout();
      
      setUser(null);
      setFirebaseUser(null);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'Failed to logout');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.resetPassword(email);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send reset email');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordByCardNumber = async (cardNumber: string) => {
    try {
      setLoading(true);
      setError(null);

      await AuthService.resetPasswordByCardNumber(cardNumber);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send reset email');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    resetPasswordByCardNumber,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

