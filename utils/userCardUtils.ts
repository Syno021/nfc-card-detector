import { User } from '@/models/User';

/**
 * Utility functions for user card displays
 */
export class UserCardUtils {
  /**
   * Get user initials from first and last name
   */
  static getInitials(user: User | null, fallback: string = 'XX'): string {
    if (!user) return fallback;
    const firstName = user.FirstName ?? user.firstName;
    const lastName = user.LastName ?? user.lastName;

    if (!firstName || !lastName) return fallback;

    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  /**
   * Get full name from user
   */
  static getFullName(user: User | null): string {
    if (!user) return '';

    const firstName = user.FirstName ?? user.firstName;
    const lastName = user.LastName ?? user.lastName;

    if (!firstName || !lastName) return '';

    return `${firstName} ${lastName}`;
  }

  /**
   * Format date to readable string
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Format date with time
   */
  static formatDateTime(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get card status text based on user state
   */
  static getCardStatus(user: User | null): string {
    if (!user) return 'Unknown';
    
    if (user.isActive && user.isApproved) {
      return 'Active & Valid';
    } else if (user.isApproved) {
      return 'Inactive';
    } else {
      return 'Pending Approval';
    }
  }

  /**
   * Get access status text
   */
  static getAccessStatusText(user: User | null, role: 'admin' | 'staff' | 'student'): string {
    if (!user) return 'Status unknown';
    
    if (user.isActive) {
      switch (role) {
        case 'admin':
          return 'All systems operational';
        case 'staff':
          return 'Card is active';
        case 'student':
          return 'Your card is active';
        default:
          return 'Card is active';
      }
    } else {
      switch (role) {
        case 'admin':
          return 'Account inactive';
        case 'staff':
          return 'Card inactive';
        case 'student':
          return 'Card inactive';
        default:
          return 'Card inactive';
      }
    }
  }

  /**
   * Get access level text based on role
   */
  static getAccessLevel(role: 'admin' | 'staff' | 'student'): string {
    switch (role) {
      case 'admin':
        return 'Full Administrator';
      case 'staff':
        return 'Department Staff';
      case 'student':
        return 'Student';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get role display name
   */
  static getRoleDisplayName(role: 'admin' | 'staff' | 'student'): string {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'staff':
        return 'Staff Member';
      case 'student':
        return 'Student';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if user has profile image
   */
  static hasProfileImage(user: User | null): boolean {
    return !!user?.imageUrl;
  }

  /**
   * Check if user has NFC ID assigned
   */
  static hasNfcId(user: User | null): boolean {
    return !!user?.nfcId;
  }

  /**
   * Get card valid until year (current year + 1)
   */
  static getCardValidYear(): number {
    return new Date().getFullYear() + 1;
  }

  /**
   * Check if card status should show warning color
   */
  static shouldShowWarning(user: User | null): boolean {
    if (!user) return true;
    return !user.isApproved;
  }

  /**
   * Check if card status should show error color
   */
  static shouldShowError(user: User | null): boolean {
    if (!user) return false;
    return !user.isActive && user.isApproved;
  }

  /**
   * Check if card status should show success color
   */
  static shouldShowSuccess(user: User | null): boolean {
    if (!user) return false;
    return user.isActive && user.isApproved;
  }
}

