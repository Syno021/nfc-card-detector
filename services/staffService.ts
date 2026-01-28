import { User } from '@/models/User';
import { UserService } from './userService';

/**
 * Staff Service
 * Handles staff-specific operations
 */
export class StaffService {
  /**
   * Get students in staff member's department
   */
  static async getDepartmentStudents(staffUser: User): Promise<User[]> {
    try {
      if (staffUser.role !== 'staff') {
        throw new Error('Only staff members can access this function');
      }

      const allStudents = await UserService.getUsersByRole('student');
      return allStudents.filter(s => s.department === staffUser.department);
    } catch (error: any) {
      console.error('Error getting department students:', error);
      throw new Error(error.message || 'Failed to fetch department students');
    }
  }

  /**
   * Approve a student (staff with permission only)
   */
  static async approveStudent(staffUser: User, studentUid: string): Promise<void> {
    try {
      // Verify staff has permission
      if (staffUser.role !== 'staff') {
        throw new Error('Only staff members can approve students');
      }

      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to approve students');
      }

      // Verify student is in same department
      const student = await UserService.getUserByUid(studentUid);
      
      if (!student) {
        throw new Error('Student not found');
      }

      if (student.role !== 'student') {
        throw new Error('Can only approve students');
      }

      if (student.department !== staffUser.department) {
        throw new Error('Can only approve students in your department');
      }

      // Approve the student
      await UserService.approveUser(studentUid);
      console.log(`Staff ${staffUser.uid} approved student ${studentUid}`);
    } catch (error: any) {
      console.error('Error approving student:', error);
      throw new Error(error.message || 'Failed to approve student');
    }
  }

  /**
   * Approve multiple students in bulk (department-scoped)
   */
  static async approveStudentsBulk(
    staffUser: User, 
    studentUids: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      // Verify staff has permission
      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to approve students');
      }

      // Get all students to verify they're in the same department
      const students = await UserService.getUsersByRole('student');
      const departmentStudentIds = new Set(
        students
          .filter(s => s.department === staffUser.department)
          .map(s => s.uid)
      );

      const promises = studentUids.map(async (uid) => {
        try {
          // Verify student is in staff's department
          if (!departmentStudentIds.has(uid)) {
            console.warn(`Student ${uid} not in staff's department, skipping`);
            failed++;
            return;
          }

          await UserService.approveUser(uid);
          success++;
        } catch (error) {
          console.error(`Failed to approve student ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error: any) {
      console.error('Error in bulk student approval:', error);
      throw new Error(error.message || 'Failed to complete bulk approval');
    }
  }

  /**
   * Activate a student (staff with permission only)
   */
  static async activateStudent(staffUser: User, studentUid: string): Promise<void> {
    try {
      // Verify staff has permission
      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to activate students');
      }

      // Verify student is in same department
      const student = await UserService.getUserByUid(studentUid);
      
      if (!student) {
        throw new Error('Student not found');
      }

      if (student.department !== staffUser.department) {
        throw new Error('Can only activate students in your department');
      }

      await UserService.updateUser(studentUid, { isActive: true });
      console.log(`Staff ${staffUser.uid} activated student ${studentUid}`);
    } catch (error: any) {
      console.error('Error activating student:', error);
      throw new Error(error.message || 'Failed to activate student');
    }
  }

  /**
   * Activate multiple students in bulk (department-scoped)
   */
  static async activateStudentsBulk(
    staffUser: User,
    studentUids: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to activate students');
      }

      const students = await UserService.getUsersByRole('student');
      const departmentStudentIds = new Set(
        students
          .filter(s => s.department === staffUser.department)
          .map(s => s.uid)
      );

      const promises = studentUids.map(async (uid) => {
        try {
          if (!departmentStudentIds.has(uid)) {
            console.warn(`Student ${uid} not in staff's department, skipping`);
            failed++;
            return;
          }

          await UserService.updateUser(uid, { isActive: true });
          success++;
        } catch (error) {
          console.error(`Failed to activate student ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error: any) {
      console.error('Error in bulk student activation:', error);
      throw new Error(error.message || 'Failed to complete bulk activation');
    }
  }

  /**
   * Deactivate a student (staff with permission only)
   */
  static async deactivateStudent(staffUser: User, studentUid: string): Promise<void> {
    try {
      // Verify staff has permission
      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to deactivate students');
      }

      // Verify student is in same department
      const student = await UserService.getUserByUid(studentUid);
      
      if (!student) {
        throw new Error('Student not found');
      }

      if (student.department !== staffUser.department) {
        throw new Error('Can only deactivate students in your department');
      }

      await UserService.deactivateUser(studentUid);
      console.log(`Staff ${staffUser.uid} deactivated student ${studentUid}`);
    } catch (error: any) {
      console.error('Error deactivating student:', error);
      throw new Error(error.message || 'Failed to deactivate student');
    }
  }

  /**
   * Deactivate multiple students in bulk (department-scoped)
   */
  static async deactivateStudentsBulk(
    staffUser: User,
    studentUids: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to deactivate students');
      }

      const students = await UserService.getUsersByRole('student');
      const departmentStudentIds = new Set(
        students
          .filter(s => s.department === staffUser.department)
          .map(s => s.uid)
      );

      const promises = studentUids.map(async (uid) => {
        try {
          if (!departmentStudentIds.has(uid)) {
            console.warn(`Student ${uid} not in staff's department, skipping`);
            failed++;
            return;
          }

          await UserService.deactivateUser(uid);
          success++;
        } catch (error) {
          console.error(`Failed to deactivate student ${uid}:`, error);
          failed++;
        }
      });

      await Promise.all(promises);

      return { success, failed };
    } catch (error: any) {
      console.error('Error in bulk student deactivation:', error);
      throw new Error(error.message || 'Failed to complete bulk deactivation');
    }
  }

  /**
   * Check if staff has approval permissions
   */
  static hasApprovalPermission(staffUser: User): boolean {
    return staffUser.role === 'staff' && staffUser.canApproveStudents === true;
  }

  /**
   * Get pending approvals in staff's department
   */
  static async getDepartmentPendingApprovals(staffUser: User): Promise<User[]> {
    try {
      if (staffUser.role !== 'staff') {
        throw new Error('Only staff members can access this function');
      }

      if (!staffUser.canApproveStudents) {
        throw new Error('You do not have permission to view pending approvals');
      }

      const pendingUsers = await UserService.getPendingApprovals();
      return pendingUsers.filter(
        u => u.role === 'student' && u.department === staffUser.department
      );
    } catch (error: any) {
      console.error('Error getting department pending approvals:', error);
      throw new Error(error.message || 'Failed to fetch pending approvals');
    }
  }
}

