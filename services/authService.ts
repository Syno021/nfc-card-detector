import { auth } from '@/config/firebase';
import { CreateUserData, LoginCredentials } from '@/models/User';
import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';

export class AuthService {
  /**
   * Register a new user with email and password
   */
  static async register(userData: CreateUserData): Promise<FirebaseUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      // Update display name
      await updateProfile(userCredential.user, {
        displayName: `${userData.FirstName} ${userData.LastName}`
      });

      return userCredential.user;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with card number and password
   */
  static async login(credentials: LoginCredentials): Promise<FirebaseUser> {
    try {
      // First, look up the user by card number to get their email
      const { UserService } = require('./userService');
      const user = await UserService.getUserByCardNumber(credentials.cardNumber);
      
      if (!user) {
        throw new Error('Invalid card number or password');
      }

      // Use the email to sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        user.email,
        credentials.password
      );
      return userCredential.user;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // If it's our custom "Invalid card number" error, throw it as-is
      if (error.message === 'Invalid card number or password') {
        throw error;
      }
      
      // For Firebase auth errors, use generic message to avoid revealing valid card numbers
      if (error.code && error.code.startsWith('auth/')) {
        throw new Error('Invalid card number or password');
      }
      
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out the current user
   */
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Send password reset email
   */
  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Send password reset email using card number
   */
  static async resetPasswordByCardNumber(cardNumber: string): Promise<void> {
    try {
      // Look up the user by card number to get their email
      const { UserService } = require('./userService');
      const user = await UserService.getUserByCardNumber(cardNumber);
      
      if (!user) {
        throw new Error('No account found with this card number');
      }

      // Send password reset email
      await sendPasswordResetEmail(auth, user.email);
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      // If it's our custom error, throw it as-is
      if (error.message === 'No account found with this card number') {
        throw error;
      }
      
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current user
   */
  static getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Delete current user account
   * Note: This requires recent authentication. User may need to re-login first.
   */
  static async deleteCurrentUser(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently logged in');
      }
      await user.delete();
    } catch (error: any) {
      console.error('Delete user error:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handle authentication errors
   */
  private static handleAuthError(error: any): Error {
    let message = 'An error occurred during authentication';

    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'This email is already registered';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email address';
        break;
      case 'auth/operation-not-allowed':
        message = 'Operation not allowed';
        break;
      case 'auth/weak-password':
        message = 'Password is too weak. Please use at least 6 characters';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled';
        break;
      case 'auth/user-not-found':
        message = 'No account found with this email';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/invalid-credential':
        message = 'Invalid email or password';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later';
        break;
      default:
        message = error.message || message;
    }

    return new Error(message);
  }
}

