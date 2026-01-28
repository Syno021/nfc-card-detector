import { User } from '@/models/User';
import { UserService } from './userService';

/**
 * Admin Service
 * Handles all administrative actions for user management
 */
export class AdminService {
  /**
   * Approve a user - grants them access to the system
   * Sets isApproved to true
   */
  static async approveUser(uid: string): Promise<void> {
    try {
      await UserService.approveUser(uid);
      console.log(`User ${uid} approved successfully`);
    } catch (error) {
      console.error('Error approving user:', error);
      throw new Error('Failed to approve user');
    }
  }

  /**
   * Approve multiple users in bulk
   */
  static async approveBulk(uids: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const promises = uids.map(async (uid) => {
        try {
          await UserService.approveUser(uid);
          success++;
        } catch (error) {
          console.error(`Failed to approve user ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error) {
      console.error('Error in bulk approval:', error);
      throw new Error('Failed to complete bulk approval');
    }
  }

  /**
   * Grant access to a user - activates their account
   * Sets isActive to true
   */
  static async grantAccess(uid: string): Promise<void> {
    try {
      await UserService.updateUser(uid, { isActive: true });
      console.log(`Access granted to user ${uid}`);
    } catch (error) {
      console.error('Error granting access:', error);
      throw new Error('Failed to grant access');
    }
  }

  /**
   * Grant access to multiple users in bulk
   */
  static async grantAccessBulk(uids: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const promises = uids.map(async (uid) => {
        try {
          await UserService.updateUser(uid, { isActive: true });
          success++;
        } catch (error) {
          console.error(`Failed to grant access to user ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error) {
      console.error('Error in bulk access grant:', error);
      throw new Error('Failed to complete bulk access grant');
    }
  }

  /**
   * Revoke access from a user - deactivates their account
   * Sets isActive to false
   */
  static async revokeAccess(uid: string): Promise<void> {
    try {
      await UserService.deactivateUser(uid);
      console.log(`Access revoked from user ${uid}`);
    } catch (error) {
      console.error('Error revoking access:', error);
      throw new Error('Failed to revoke access');
    }
  }

  /**
   * Revoke access from multiple users in bulk
   */
  static async revokeAccessBulk(uids: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const promises = uids.map(async (uid) => {
        try {
          await UserService.deactivateUser(uid);
          success++;
        } catch (error) {
          console.error(`Failed to revoke access from user ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error) {
      console.error('Error in bulk access revocation:', error);
      throw new Error('Failed to complete bulk access revocation');
    }
  }

  /**
   * Reject a user - deactivates their account (typically for pending users)
   * Sets isActive to false
   */
  static async rejectUser(uid: string): Promise<void> {
    try {
      await UserService.deactivateUser(uid);
      console.log(`User ${uid} rejected successfully`);
    } catch (error) {
      console.error('Error rejecting user:', error);
      throw new Error('Failed to reject user');
    }
  }

  /**
   * Reject multiple users in bulk
   */
  static async rejectBulk(uids: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const promises = uids.map(async (uid) => {
        try {
          await UserService.deactivateUser(uid);
          success++;
        } catch (error) {
          console.error(`Failed to reject user ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error) {
      console.error('Error in bulk rejection:', error);
      throw new Error('Failed to complete bulk rejection');
    }
  }

  /**
   * Grant student approval rights to a staff member
   * Sets canApproveStudents to true
   */
  static async grantApprovalRights(staffUid: string): Promise<void> {
    try {
      // Verify user is staff
      const user = await UserService.getUserByUid(staffUid);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'staff') {
        throw new Error('Only staff members can be granted approval rights');
      }

      await UserService.updateStaffApprovalPermission(staffUid, true);
      console.log(`Approval rights granted to staff ${staffUid}`);
    } catch (error: any) {
      console.error('Error granting approval rights:', error);
      throw new Error(error.message || 'Failed to grant approval rights');
    }
  }

  /**
   * Revoke student approval rights from a staff member
   * Sets canApproveStudents to false
   */
  static async revokeApprovalRights(staffUid: string): Promise<void> {
    try {
      // Verify user is staff
      const user = await UserService.getUserByUid(staffUid);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'staff') {
        throw new Error('Only staff members have approval rights');
      }

      await UserService.updateStaffApprovalPermission(staffUid, false);
      console.log(`Approval rights revoked from staff ${staffUid}`);
    } catch (error: any) {
      console.error('Error revoking approval rights:', error);
      throw new Error(error.message || 'Failed to revoke approval rights');
    }
  }

  /**
   * Toggle student approval rights for a staff member
   */
  static async toggleApprovalRights(staffUid: string): Promise<boolean> {
    try {
      const user = await UserService.getUserByUid(staffUid);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'staff') {
        throw new Error('Only staff members can have approval rights');
      }

      const newValue = !user.canApproveStudents;
      await UserService.updateStaffApprovalPermission(staffUid, newValue);
      
      console.log(`Approval rights ${newValue ? 'granted to' : 'revoked from'} staff ${staffUid}`);
      return newValue;
    } catch (error: any) {
      console.error('Error toggling approval rights:', error);
      throw new Error(error.message || 'Failed to toggle approval rights');
    }
  }

  /**
   * Approve and activate a user in one operation
   * Useful for fast-track approvals
   */
  static async approveAndActivate(uid: string): Promise<void> {
    try {
      await UserService.updateUser(uid, {
        isApproved: true,
        isActive: true,
      });
      console.log(`User ${uid} approved and activated`);
    } catch (error) {
      console.error('Error approving and activating user:', error);
      throw new Error('Failed to approve and activate user');
    }
  }

  /**
   * Approve and activate multiple users in bulk
   */
  static async approveAndActivateBulk(uids: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const promises = uids.map(async (uid) => {
        try {
          await UserService.updateUser(uid, {
            isApproved: true,
            isActive: true,
          });
          success++;
        } catch (error) {
          console.error(`Failed to approve and activate user ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error) {
      console.error('Error in bulk approve and activate:', error);
      throw new Error('Failed to complete bulk operation');
    }
  }

  /**
   * Get all users pending approval
   */
  static async getPendingApprovals(): Promise<User[]> {
    try {
      return await UserService.getPendingApprovals();
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw new Error('Failed to fetch pending approvals');
    }
  }

  /**
   * Get summary statistics for admin dashboard
   */
  static async getDashboardStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    pendingApprovals: number;
    totalStudents: number;
    totalStaff: number;
    staffWithApprovalRights: number;
  }> {
    try {
      const [allUsers, pendingUsers, students, staff] = await Promise.all([
        UserService.getAllUsers(),
        UserService.getPendingApprovals(),
        UserService.getUsersByRole('student'),
        UserService.getUsersByRole('staff'),
      ]);

      const activeUsers = allUsers.filter(u => u.isActive && u.isApproved).length;
      const staffWithApprovalRights = staff.filter(s => s.canApproveStudents).length;

      return {
        totalUsers: allUsers.length,
        activeUsers,
        pendingApprovals: pendingUsers.length,
        totalStudents: students.length,
        totalStaff: staff.length,
        staffWithApprovalRights,
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  /**
   * Assign NFC card to a user (admin only)
   */
  static async assignNfcCard(uid: string, nfcId: string): Promise<void> {
    try {
      await UserService.assignNfcId(uid, nfcId);
      console.log(`NFC card ${nfcId} assigned to user ${uid}`);
    } catch (error: any) {
      console.error('Error assigning NFC card:', error);
      throw new Error(error.message || 'Failed to assign NFC card');
    }
  }

  /**
   * Remove NFC card from a user
   */
  static async removeNfcCard(uid: string): Promise<void> {
    try {
      await UserService.updateUser(uid, { nfcId: undefined });
      console.log(`NFC card removed from user ${uid}`);
    } catch (error) {
      console.error('Error removing NFC card:', error);
      throw new Error('Failed to remove NFC card');
    }
  }

  /**
   * Get users by department (for department-based management)
   */
  static async getUsersByDepartment(department: string): Promise<User[]> {
    try {
      const allUsers = await UserService.getAllUsers();
      return allUsers.filter(u => u.department === department);
    } catch (error) {
      console.error('Error getting users by department:', error);
      throw new Error('Failed to fetch users by department');
    }
  }

  /**
   * Get students by department
   */
  static async getStudentsByDepartment(department: string): Promise<User[]> {
    try {
      const students = await UserService.getUsersByRole('student');
      return students.filter(s => s.department === department);
    } catch (error) {
      console.error('Error getting students by department:', error);
      throw new Error('Failed to fetch students by department');
    }
  }

  /**
   * Validate user has required permissions
   */
  static validateUserCanApprove(user: User | null): boolean {
    if (!user) return false;
    
    // Admins can always approve
    if (user.role === 'admin') return true;
    
    // Staff need specific permission
    if (user.role === 'staff') return user.canApproveStudents === true;
    
    // Students cannot approve
    return false;
  }

  /**
   * Get list of users that a staff member can manage
   * (students in the same department)
   */
  static async getManagedStudents(staffUser: User): Promise<User[]> {
    try {
      if (staffUser.role !== 'staff') {
        throw new Error('Only staff members can manage students');
      }

      if (!staffUser.canApproveStudents) {
        throw new Error('Staff member does not have approval permissions');
      }

      return await this.getStudentsByDepartment(staffUser.department);
    } catch (error: any) {
      console.error('Error getting managed students:', error);
      throw new Error(error.message || 'Failed to fetch managed students');
    }
  }
}

