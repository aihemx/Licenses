/**
 * نظام إدارة التراخيص - User Service
 */

// ======================== GET USER ========================

/**
 * Get user by email
 */
function getUserByEmail(email) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.USER_COLUMNS.EMAIL].toLowerCase() === email.toLowerCase()) {
        return rowToUser(row);
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('getUserByEmail Error:', error);
    return null;
  }
}

/**
 * Get all users (Admin only)
 */
function getAllUsers() {
  try {
    requireRole([ROLES.ADMIN]);
    
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    const users = [];
    for (let i = 1; i < data.length; i++) {
      users.push(rowToUser(data[i]));
    }
    
    return successResponse(users);
    
  } catch (error) {
    console.error('getAllUsers Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== UPDATE USER ========================

/**
 * Update last login timestamp
 */
function updateLastLogin(email) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.USER_COLUMNS.EMAIL].toLowerCase() === email.toLowerCase()) {
        // Update Last Login (column index + 1 for Range)
        sheet.getRange(i + 1, CONFIG.USER_COLUMNS.LAST_LOGIN + 1)
          .setValue(getCurrentTimestamp());
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('updateLastLogin Error:', error);
    return false;
  }
}

// ======================== CREATE USER (Admin Only) ========================

/**
 * Create new user
 */
function createUser(userData) {
  try {
    requireRole([ROLES.ADMIN]);
    
    const email = sanitize(userData.email).toLowerCase();
    const fullName = sanitize(userData.fullName);
    const role = sanitize(userData.role);
    
    // Validation
    if (isEmpty(email) || !email.includes('@')) {
      return errorResponse('البريد الإلكتروني غير صالح');
    }
    
    if (isEmpty(fullName) || fullName.length < 3) {
      return errorResponse('الاسم يجب أن يكون 3 أحرف على الأقل');
    }
    
    if (!Object.values(ROLES).includes(role)) {
      return errorResponse('الدور غير صالح');
    }
    
    // Check if user exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return errorResponse('هذا البريد مسجل مسبقاً');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    
    const newUser = [
      email,
      fullName,
      role,
      'Active',
      getCurrentTimestamp(),
      ''
    ];
    
    sheet.appendRow(newUser);
    
    logAction('CREATE_USER', { email, fullName, role });
    
    return successResponse({ email, fullName, role }, 'تم إنشاء المستخدم بنجاح');
    
  } catch (error) {
    console.error('createUser Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== UPDATE USER (Admin Only) ========================

/**
 * Update user status/role
 */
function updateUser(email, updates) {
  try {
    requireRole([ROLES.ADMIN]);
    
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.USER_COLUMNS.EMAIL].toLowerCase() === email.toLowerCase()) {
        
        if (updates.role && Object.values(ROLES).includes(updates.role)) {
          sheet.getRange(i + 1, CONFIG.USER_COLUMNS.ROLE + 1).setValue(updates.role);
        }
        
        if (updates.status && ['Active', 'Disabled'].includes(updates.status)) {
          sheet.getRange(i + 1, CONFIG.USER_COLUMNS.STATUS + 1).setValue(updates.status);
        }
        
        if (updates.fullName && updates.fullName.length >= 3) {
          sheet.getRange(i + 1, CONFIG.USER_COLUMNS.FULL_NAME + 1).setValue(sanitize(updates.fullName));
        }
        
        logAction('UPDATE_USER', { email, updates });
        
        return successResponse(null, 'تم تحديث المستخدم بنجاح');
      }
    }
    
    return errorResponse('المستخدم غير موجود');
    
  } catch (error) {
    console.error('updateUser Error:', error);
    return errorResponse(error.message);
  }
}
