import { db } from '@/config/firebase';
import { CreateUserData, User, UserRole } from '@/models/User';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { ImageService } from './imageService';

const USERS_COLLECTION = 'users';

export class UserService {
  /**
   * Create a new user document in Firestore
   */
  static async createUser(authUid: string, userData: Omit<CreateUserData, 'password'>): Promise<User> {
    try {
      // Check for duplicate card number
      const existingCard = await this.getUserByCardNumber(userData.cardNumber);
      if (existingCard) {
        throw new Error('Card number already exists');
      }

      const userRef = doc(collection(db, USERS_COLLECTION));
      
      // Upload image if provided
      let imageUrl: string | undefined;
      if (userData.imageBase64) {
        try {
          imageUrl = await ImageService.uploadBase64Image(
            userData.imageBase64,
            userRef.id,
            'profile-images'
          );
        } catch (imageError) {
          console.error('Error uploading profile image:', imageError);
          // Continue without image - don't fail the entire registration
        }
      }
      
      // Prepare user data - don't include nfcId at all if it's undefined
      const newUserData: any = {
        authUid,
        email: userData.email,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        cardNumber: userData.cardNumber,
        role: userData.role,
        department: userData.department,
        isActive: true,
        isApproved: userData.role === 'admin' ? true : false, // Auto-approve admins
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Only add imageUrl if it exists
      if (imageUrl) {
        newUserData.imageUrl = imageUrl;
      }

      // Set canApproveStudents to false by default for staff
      if (userData.role === 'staff') {
        newUserData.canApproveStudents = false;
      }

      await setDoc(userRef, newUserData);

      return {
        uid: userRef.id,
        authUid,
        email: userData.email,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        cardNumber: userData.cardNumber,
        role: userData.role,
        department: userData.department,
        imageUrl,
        isActive: true,
        isApproved: userData.role === 'admin' ? true : false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.message === 'Card number already exists') {
        throw error;
      }
      throw new Error('Failed to create user profile');
    }
  }

  /**
   * Get user by authentication UID
   */
  static async getUserByAuthUid(authUid: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('authUid', '==', authUid)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      return {
        uid: userDoc.id,
        authUid: userData.authUid,
        email: userData.email,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        cardNumber: userData.cardNumber,
        nfcId: userData.nfcId,
        imageUrl: userData.imageUrl,
        role: userData.role as UserRole,
        department: userData.department,
        isActive: userData.isActive,
        isApproved: userData.isApproved,
        canApproveStudents: userData.canApproveStudents,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting user by auth UID:', error);
      throw new Error('Failed to fetch user data');
    }
  }

  /**
   * Get user by document UID
   */
  static async getUserByUid(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
      
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();

      return {
        uid: userDoc.id,
        authUid: userData.authUid,
        email: userData.email,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        cardNumber: userData.cardNumber,
        nfcId: userData.nfcId,
        imageUrl: userData.imageUrl,
        role: userData.role as UserRole,
        department: userData.department,
        isActive: userData.isActive,
        isApproved: userData.isApproved,
        canApproveStudents: userData.canApproveStudents,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting user by UID:', error);
      throw new Error('Failed to fetch user data');
    }
  }

  /**
   * Get all users (admin only)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          uid: doc.id,
          authUid: userData.authUid,
          email: userData.email,
          FirstName: userData.FirstName,
          LastName: userData.LastName,
          cardNumber: userData.cardNumber,
          nfcId: userData.nfcId,
          imageUrl: userData.imageUrl,
          role: userData.role as UserRole,
          department: userData.department,
          isActive: userData.isActive,
          isApproved: userData.isApproved,
          canApproveStudents: userData.canApproveStudents,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Get users by role
   */
  static async getUsersByRole(role: UserRole): Promise<User[]> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('role', '==', role),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          uid: doc.id,
          authUid: userData.authUid,
          email: userData.email,
          FirstName: userData.FirstName,
          LastName: userData.LastName,
          cardNumber: userData.cardNumber,
          nfcId: userData.nfcId,
          imageUrl: userData.imageUrl,
          role: userData.role as UserRole,
          department: userData.department,
          isActive: userData.isActive,
          isApproved: userData.isApproved,
          canApproveStudents: userData.canApproveStudents,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error getting users by role:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Update user
   */
  static async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      // Convert Date objects to Timestamps
      if (updates.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }

      await updateDoc(userRef, updateData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, USERS_COLLECTION, uid));
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Approve user
   */
  static async approveUser(uid: string): Promise<void> {
    try {
      await this.updateUser(uid, { isApproved: true });
    } catch (error) {
      console.error('Error approving user:', error);
      throw new Error('Failed to approve user');
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(uid: string): Promise<void> {
    try {
      await this.updateUser(uid, { isActive: false });
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw new Error('Failed to deactivate user');
    }
  }

  /**
   * Get pending approvals
   */
  static async getPendingApprovals(): Promise<User[]> {
    try {
      // Query for users where isApproved is false
      // Note: This requires a Firestore composite index on (isApproved, createdAt)
      const q = query(
        collection(db, USERS_COLLECTION),
        where('isApproved', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Sort by createdAt on client side to avoid index requirement
      const users = querySnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          uid: doc.id,
          authUid: userData.authUid,
          email: userData.email,
          FirstName: userData.FirstName,
          LastName: userData.LastName,
          cardNumber: userData.cardNumber,
          nfcId: userData.nfcId,
          imageUrl: userData.imageUrl,
          role: userData.role as UserRole,
          department: userData.department,
          isActive: userData.isActive,
          isApproved: userData.isApproved,
          canApproveStudents: userData.canApproveStudents,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        };
      });

      // Sort by createdAt descending
      return users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error: any) {
      console.error('Error getting pending approvals:', error);
      console.error('Error details:', error.message, error.code);
      throw new Error('Failed to fetch pending approvals');
    }
  }

  /**
   * Update user profile image
   */
  static async updateUserImage(uid: string, imageBase64: string, oldImageUrl?: string): Promise<string> {
    try {
      const imageUrl = await ImageService.updateProfileImage(imageBase64, uid, oldImageUrl);
      await this.updateUser(uid, { imageUrl });
      return imageUrl;
    } catch (error) {
      console.error('Error updating user image:', error);
      throw new Error('Failed to update profile image');
    }
  }

  /**
   * Assign NFC ID to user (admin only)
   */
  static async assignNfcId(uid: string, nfcId: string): Promise<void> {
    try {
      // Check if NFC ID is already assigned to another user
      const existingUser = await this.getUserByNfcId(nfcId);
      if (existingUser && existingUser.uid !== uid) {
        throw new Error('NFC ID already assigned to another user');
      }
      
      await this.updateUser(uid, { nfcId });
    } catch (error) {
      console.error('Error assigning NFC ID:', error);
      throw new Error('Failed to assign NFC ID');
    }
  }

  /**
   * Get user by NFC ID
   */
  static async getUserByNfcId(nfcId: string): Promise<User | null> {
    try {
      if (!nfcId) {
        return null;
      }

      const q = query(
        collection(db, USERS_COLLECTION),
        where('nfcId', '==', nfcId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      return {
        uid: userDoc.id,
        authUid: userData.authUid,
        email: userData.email,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        cardNumber: userData.cardNumber,
        nfcId: userData.nfcId,
        imageUrl: userData.imageUrl,
        role: userData.role as UserRole,
        department: userData.department,
        isActive: userData.isActive,
        isApproved: userData.isApproved,
        canApproveStudents: userData.canApproveStudents,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting user by NFC ID:', error);
      throw new Error('Failed to fetch user by NFC ID');
    }
  }

  /**
   * Update staff approval permissions (admin only)
   */
  static async updateStaffApprovalPermission(uid: string, canApproveStudents: boolean): Promise<void> {
    try {
      await this.updateUser(uid, { canApproveStudents });
    } catch (error) {
      console.error('Error updating staff approval permission:', error);
      throw new Error('Failed to update staff permissions');
    }
  }

  /**
   * Get user by card number
   */
  static async getUserByCardNumber(cardNumber: string): Promise<User | null> {
    try {
      if (!cardNumber) {
        return null;
      }

      const q = query(
        collection(db, USERS_COLLECTION),
        where('cardNumber', '==', cardNumber)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      return {
        uid: userDoc.id,
        authUid: userData.authUid,
        email: userData.email,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        cardNumber: userData.cardNumber,
        nfcId: userData.nfcId,
        imageUrl: userData.imageUrl,
        role: userData.role as UserRole,
        department: userData.department,
        isActive: userData.isActive,
        isApproved: userData.isApproved,
        canApproveStudents: userData.canApproveStudents,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting user by card number:', error);
      throw new Error('Failed to fetch user by card number');
    }
  }
}

