/**
 * نظام إدارة التراخيص - Authentication & Authorization
 */

// ======================== ROLES & PERMISSIONS ========================

const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  VIEWER: 'Viewer'
};

const PERMISSIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  CHANGE_STATUS: 'change_status'
};

// Permission Matrix
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.EDIT,
    PERMISSIONS.DELETE,
    PERMISSIONS.CHANGE_STATUS
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.EDIT,
    PERMISSIONS.CHANGE_STATUS
  ],
  [ROLES.AGENT]: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW
  ]
};

// ======================== AUTHENTICATION ========================

/**
 * Get current logged-in user
 * Uses Session.getActiveUser() - works only when deployed as Web App
 */
function getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    
    if (!email) {
      console.log('No active user email found');
      return null;
    }
    
    const user = getUserByEmail(email);
    return user;
    
  } catch (error) {
    console.error('getCurrentUser Error:', error);
    return null;
  }
}

/**
 * Get current user info (for client-side)
 */
function getCurrentUserInfo() {
  const user = getCurrentUser();
  if (!user) {
    return errorResponse('غير مصرح بالدخول', 'UNAUTHORIZED');
  }
  
  return successResponse({
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role] || []
  });
}

// ======================== AUTHORIZATION ========================

/**
 * Check if current user has specific permission
 */
function checkPermission(permission) {
  const user = getCurrentUser();
  
  if (!user) {
    return false;
  }
  
  if (user.status !== 'Active') {
    return false;
  }
  
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
}

/**
 * Check if current user has one of required roles
 */
function hasRole(requiredRoles) {
  const user = getCurrentUser();
  
  if (!user) {
    return false;
  }
  
  if (user.status !== 'Active') {
    return false;
  }
  
  // If string, convert to array
  if (typeof requiredRoles === 'string') {
    requiredRoles = [requiredRoles];
  }
  
  return requiredRoles.includes(user.role);
}

/**
 * Require permission - throws error if not authorized
 */
function requirePermission(permission) {
  if (!checkPermission(permission)) {
    throw new Error('غير مصرح لك بتنفيذ هذا الإجراء');
  }
}

/**
 * Require role - throws error if not authorized
 */
function requireRole(requiredRoles) {
  if (!hasRole(requiredRoles)) {
    throw new Error('صلاحياتك لا تسمح بتنفيذ هذا الإجراء');
  }
}

// ======================== STATUS CHANGE PERMISSION ========================

/**
 * Check if user can change to specific status
 * Admin/Manager can set: Suspended, Inactive
 * But Expired is system-controlled
 */
function canChangeToStatus(targetStatus) {
  const user = getCurrentUser();
  
  if (!user) return false;
  
  // Only Admin and Manager can change status
  if (!hasRole([ROLES.ADMIN, ROLES.MANAGER])) {
    return false;
  }
  
  // Allowed manual statuses
  const allowedManualStatuses = ['Suspended', 'Inactive'];
  
  return allowedManualStatuses.includes(targetStatus);
}

// ======================== PERMISSION CHECK WRAPPER ========================

/**
 * Permission-checked wrapper for functions
 */
function withPermission(permission, fn) {
  return function(...args) {
    requirePermission(permission);
    return fn.apply(this, args);
  };
}
