/**
 * نظام إدارة التراخيص - License Service
 * CRUD Operations + Daily Check
 */

// ======================== READ LICENSES ========================

/**
 * Get all licenses (excluding soft-deleted)
 */
function getAllLicenses() {
  try {
    const user = getCurrentUser();
    if (!user) {
      return errorResponse('غير مصرح بالدخول', 'UNAUTHORIZED');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    const licenses = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const notes = row[CONFIG.LICENSE_COLUMNS.NOTES] || '';
      
      // Skip deleted licenses
      if (notes.includes('DELETED')) continue;
      
      // Skip empty rows
      if (!row[CONFIG.LICENSE_COLUMNS.ID]) continue;
      
      licenses.push(rowToLicense(row));
    }
    
    return successResponse(licenses);
    
  } catch (error) {
    console.error('getAllLicenses Error:', error);
    return errorResponse(error.message);
  }
}

/**
 * Get single license by ID
 */
function getLicenseById(id) {
  try {
    const user = getCurrentUser();
    if (!user) {
      return errorResponse('غير مصرح بالدخول', 'UNAUTHORIZED');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.LICENSE_COLUMNS.ID] === id) {
        const notes = data[i][CONFIG.LICENSE_COLUMNS.NOTES] || '';
        if (notes.includes('DELETED')) {
          return errorResponse('الترخيص غير موجود');
        }
        return successResponse(rowToLicense(data[i]));
      }
    }
    
    return errorResponse('الترخيص غير موجود');
    
  } catch (error) {
    console.error('getLicenseById Error:', error);
    return errorResponse(error.message);
  }
}

/**
 * Get dashboard statistics
 */
function getDashboardStats() {
  try {
    const user = getCurrentUser();
    if (!user) {
      return errorResponse('غير مصرح بالدخول', 'UNAUTHORIZED');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    const stats = {
      total: 0,
      active: 0,
      expired: 0,
      pending: 0,
      suspended: 0,
      inactive: 0,
      expiringIn7Days: 0,
      expiringLicenses: []
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const notes = row[CONFIG.LICENSE_COLUMNS.NOTES] || '';
      const id = row[CONFIG.LICENSE_COLUMNS.ID];
      
      // Skip deleted and empty
      if (notes.includes('DELETED') || !id) continue;
      
      stats.total++;
      
      const status = row[CONFIG.LICENSE_COLUMNS.STATUS];
      const endDate = new Date(row[CONFIG.LICENSE_COLUMNS.END_DATE]);
      
      switch (status) {
        case 'Active': stats.active++; break;
        case 'Expired': stats.expired++; break;
        case 'Pending': stats.pending++; break;
        case 'Suspended': stats.suspended++; break;
        case 'Inactive': stats.inactive++; break;
      }
      
      // Check expiring soon
      if (status === 'Active' && endDate <= sevenDaysLater && endDate >= today) {
        stats.expiringIn7Days++;
        stats.expiringLicenses.push({
          id: id,
          clientName: row[CONFIG.LICENSE_COLUMNS.CLIENT_NAME],
          endDate: formatDate(endDate),
          remaining: row[CONFIG.LICENSE_COLUMNS.REMAINING]
        });
      }
    }
    
    // Sort by end date
    stats.expiringLicenses.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    
    return successResponse(stats);
    
  } catch (error) {
    console.error('getDashboardStats Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== CREATE LICENSE ========================

/**
 * Create new license
 */
function createLicense(data) {
  try {
    // Check permission
    requirePermission(PERMISSIONS.CREATE);
    
    const user = getCurrentUser();
    
    // Validate
    const validation = validateLicense(data, false);
    if (!validation.valid) {
      return errorResponse(validation.errors.join(' | '));
    }
    
    // Check duplicate WhatsApp
    if (isWhatsappDuplicate(validation.data.whatsapp)) {
      return errorResponse('رقم الواتساب مسجل مسبقاً لعميل آخر');
    }
    
    // Calculate values
    const now = getCurrentTimestamp();
    const duration = calculateDuration(validation.data.startDate, validation.data.endDate);
    const remaining = calculateRemainingDays(validation.data.endDate);
    const status = calculateStatus(validation.data.startDate, validation.data.endDate);
    
    // Create new license row
    const newLicense = [
      generateId(),                        // ID
      validation.data.clientName,          // Client Name
      validation.data.whatsapp,            // Whatsapp
      validation.data.subscriptionType,    // Subscription Type
      status,                              // Status (calculated)
      validation.data.startDate,           // Start Date
      validation.data.endDate,             // End Date
      duration,                            // Duration
      remaining,                           // Remaining
      now,                                 // Created At
      user.email,                          // Created By
      '',                                  // Updated At
      '',                                  // Updated By
      now,                                 // Last Checked
      validation.data.notes                // Notes
    ];
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    sheet.appendRow(newLicense);
    
    logAction('CREATE_LICENSE', { 
      id: newLicense[0], 
      clientName: validation.data.clientName,
      createdBy: user.email 
    });
    
    return successResponse({ id: newLicense[0] }, 'تم إنشاء الترخيص بنجاح');
    
  } catch (error) {
    console.error('createLicense Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== UPDATE LICENSE ========================

/**
 * Update existing license
 */
function updateLicense(id, data) {
  try {
    // Check permission
    requirePermission(PERMISSIONS.EDIT);
    
    const user = getCurrentUser();
    
    // Validate
    const validation = validateLicense(data, true);
    if (!validation.valid) {
      return errorResponse(validation.errors.join(' | '));
    }
    
    // Check duplicate WhatsApp (excluding current)
    if (isWhatsappDuplicate(validation.data.whatsapp, id)) {
      return errorResponse('رقم الواتساب مسجل مسبقاً لعميل آخر');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data_all = sheet.getDataRange().getValues();
    
    // Find license row
    let rowIndex = -1;
    for (let i = 1; i < data_all.length; i++) {
      if (data_all[i][CONFIG.LICENSE_COLUMNS.ID] === id) {
        const notes = data_all[i][CONFIG.LICENSE_COLUMNS.NOTES] || '';
        if (notes.includes('DELETED')) {
          return errorResponse('الترخيص غير موجود');
        }
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return errorResponse('الترخيص غير موجود');
    }
    
    const now = getCurrentTimestamp();
    const duration = calculateDuration(validation.data.startDate, validation.data.endDate);
    const remaining = calculateRemainingDays(validation.data.endDate);
    
    // Determine status
    let status;
    if (validation.data.manualStatus) {
      status = validation.data.manualStatus;
    } else {
      const currentStatus = data_all[rowIndex][CONFIG.LICENSE_COLUMNS.STATUS];
      status = calculateStatus(validation.data.startDate, validation.data.endDate, currentStatus);
    }
    
    // Update values (row is 1-indexed, add 1 for header)
    const rowNum = rowIndex + 1;
    const cols = CONFIG.LICENSE_COLUMNS;
    
    sheet.getRange(rowNum, cols.CLIENT_NAME + 1).setValue(validation.data.clientName);
    sheet.getRange(rowNum, cols.WHATSAPP + 1).setValue(validation.data.whatsapp);
    sheet.getRange(rowNum, cols.SUBSCRIPTION_TYPE + 1).setValue(validation.data.subscriptionType);
    sheet.getRange(rowNum, cols.STATUS + 1).setValue(status);
    sheet.getRange(rowNum, cols.START_DATE + 1).setValue(validation.data.startDate);
    sheet.getRange(rowNum, cols.END_DATE + 1).setValue(validation.data.endDate);
    sheet.getRange(rowNum, cols.DURATION + 1).setValue(duration);
    sheet.getRange(rowNum, cols.REMAINING + 1).setValue(remaining);
    sheet.getRange(rowNum, cols.UPDATED_AT + 1).setValue(now);
    sheet.getRange(rowNum, cols.UPDATED_BY + 1).setValue(user.email);
    sheet.getRange(rowNum, cols.NOTES + 1).setValue(validation.data.notes);
    
    logAction('UPDATE_LICENSE', { id, updatedBy: user.email });
    
    return successResponse(null, 'تم تحديث الترخيص بنجاح');
    
  } catch (error) {
    console.error('updateLicense Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== DELETE LICENSE (SOFT) ========================

/**
 * Soft delete license - marks as deleted in notes
 */
function deleteLicense(id) {
  try {
    // Only Admin can delete
    requireRole([ROLES.ADMIN]);
    
    const user = getCurrentUser();
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.LICENSE_COLUMNS.ID] === id) {
        const notes = data[i][CONFIG.LICENSE_COLUMNS.NOTES] || '';
        
        if (notes.includes('DELETED')) {
          return errorResponse('الترخيص محذوف مسبقاً');
        }
        
        // Soft delete by marking in notes
        const deleteNote = `DELETED by ${user.email} at ${formatDate(new Date())}`;
        const newNotes = notes ? `${notes} | ${deleteNote}` : deleteNote;
        
        const rowNum = i + 1;
        sheet.getRange(rowNum, CONFIG.LICENSE_COLUMNS.NOTES + 1).setValue(newNotes);
        sheet.getRange(rowNum, CONFIG.LICENSE_COLUMNS.UPDATED_AT + 1).setValue(getCurrentTimestamp());
        sheet.getRange(rowNum, CONFIG.LICENSE_COLUMNS.UPDATED_BY + 1).setValue(user.email);
        
        logAction('DELETE_LICENSE', { id, deletedBy: user.email });
        
        return successResponse(null, 'تم حذف الترخيص بنجاح');
      }
    }
    
    return errorResponse('الترخيص غير موجود');
    
  } catch (error) {
    console.error('deleteLicense Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== DAILY CHECK (TRIGGER) ========================

/**
 * Daily license check - updates status and remaining days
 * Called by time-based trigger
 */
function checkLicenses() {
  try {
    console.log('🔄 Starting daily license check...');
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    const now = getCurrentTimestamp();
    
    let updatedCount = 0;
    
    // Prepare batch updates
    const updates = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = row[CONFIG.LICENSE_COLUMNS.ID];
      const notes = row[CONFIG.LICENSE_COLUMNS.NOTES] || '';
      
      // Skip deleted and empty
      if (notes.includes('DELETED') || !id) continue;
      
      const startDate = row[CONFIG.LICENSE_COLUMNS.START_DATE];
      const endDate = row[CONFIG.LICENSE_COLUMNS.END_DATE];
      const currentStatus = row[CONFIG.LICENSE_COLUMNS.STATUS];
      
      // Calculate new values
      const newStatus = calculateStatus(startDate, endDate, currentStatus);
      const newRemaining = calculateRemainingDays(endDate);
      
      // Check if update needed
      if (newStatus !== currentStatus || row[CONFIG.LICENSE_COLUMNS.REMAINING] !== newRemaining) {
        updates.push({
          row: i + 1,
          status: newStatus,
          remaining: newRemaining
        });
        updatedCount++;
      }
    }
    
    // Apply updates
    updates.forEach(update => {
      sheet.getRange(update.row, CONFIG.LICENSE_COLUMNS.STATUS + 1).setValue(update.status);
      sheet.getRange(update.row, CONFIG.LICENSE_COLUMNS.REMAINING + 1).setValue(update.remaining);
      sheet.getRange(update.row, CONFIG.LICENSE_COLUMNS.LAST_CHECKED + 1).setValue(now);
    });
    
    console.log(`✅ Daily check complete. Updated ${updatedCount} licenses.`);
    
    return { success: true, updated: updatedCount };
    
  } catch (error) {
    console.error('checkLicenses Error:', error);
    return { success: false, error: error.message };
  }
}

// ======================== SEARCH & FILTER ========================

/**
 * Search licenses by client name or WhatsApp
 */
function searchLicenses(query) {
  try {
    const user = getCurrentUser();
    if (!user) {
      return errorResponse('غير مصرح بالدخول', 'UNAUTHORIZED');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    const searchTerm = sanitize(query).toLowerCase();
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const notes = row[CONFIG.LICENSE_COLUMNS.NOTES] || '';
      const id = row[CONFIG.LICENSE_COLUMNS.ID];
      
      // Skip deleted and empty
      if (notes.includes('DELETED') || !id) continue;
      
      const clientName = (row[CONFIG.LICENSE_COLUMNS.CLIENT_NAME] || '').toLowerCase();
      const whatsapp = (row[CONFIG.LICENSE_COLUMNS.WHATSAPP] || '').toLowerCase();
      
      if (clientName.includes(searchTerm) || whatsapp.includes(searchTerm)) {
        results.push(rowToLicense(row));
      }
    }
    
    return successResponse(results);
    
  } catch (error) {
    console.error('searchLicenses Error:', error);
    return errorResponse(error.message);
  }
}

/**
 * Filter licenses by status
 */
function filterLicensesByStatus(status) {
  try {
    const user = getCurrentUser();
    if (!user) {
      return errorResponse('غير مصرح بالدخول', 'UNAUTHORIZED');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const notes = row[CONFIG.LICENSE_COLUMNS.NOTES] || '';
      const id = row[CONFIG.LICENSE_COLUMNS.ID];
      
      // Skip deleted and empty
      if (notes.includes('DELETED') || !id) continue;
      
      if (row[CONFIG.LICENSE_COLUMNS.STATUS] === status) {
        results.push(rowToLicense(row));
      }
    }
    
    return successResponse(results);
    
  } catch (error) {
    console.error('filterLicensesByStatus Error:', error);
    return errorResponse(error.message);
  }
}
