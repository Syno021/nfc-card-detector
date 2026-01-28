export type UserRole = 'admin' | 'staff' | 'student';

export interface User {
  uid: string;
  authUid: string;
  email: string;
  FirstName: string;
  LastName: string;
  /**
   * @deprecated Legacy lowercase name fields retained for backward compatibility
   */
  firstName?: string;
  lastName?: string;
  cardNumber: string;
  nfcId?: string; // Optional - assigned by admin after approval
  imageUrl?: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  isApproved: boolean;
  canApproveStudents?: boolean; // Staff only - permission to approve students
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  FirstName: string;
  LastName: string;
  cardNumber: string;
  imageBase64?: string;
  role: UserRole;
  department: string;
}

export interface LoginCredentials {
  cardNumber: string;
  password: string;
}

