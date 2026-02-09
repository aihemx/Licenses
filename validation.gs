/**
 * نظام إدارة التراخيص - Validation
 */

// ======================== WHATSAPP NORMALIZATION ========================

/**
 * Normalize WhatsApp number to +218XXXXXXXXX format
 * 
 * Rules:
 * - Remove spaces, dashes, parentheses, dots
 * - If starts with 00 → replace with +
 * - If starts with 0 → replace with +218
 * - If no country code → add +218
 * - Reject if less than 12 digits
 */
function normalizeWhatsapp(number) {
  if (!number) {
    throw new Error('رقم الواتساب مطلوب');
  }
  
  // Convert to string and clean
  let cleaned = String(number)
    .trim()
    .replace(/[\s\-\(\)\.\u200B\u200C\u200D]/g, ''); // Remove spaces, dashes, parentheses, dots, zero-width chars
  
  // Handle different formats
  if (cleaned.startsWith('00')) {
    // 00218912345678 → +218912345678
    cleaned = '+' + cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    // 0912345678 → +218912345678
    cleaned = '+218' + cleaned.slice(1);
  } else if (cleaned.startsWith('218')) {
    // 218912345678 → +218912345678
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    // 912345678 → +218912345678
    cleaned = '+218' + cleaned;
  }
  
  // Validate length (minimum 12 characters including +)
  if (cleaned.length < 12) {
    throw new Error('رقم الواتساب غير صالح - يجب أن يكون 12 رقم على الأقل');
  }
  
  // Validate format
  if (!/^\+218\d{9,}$/.test(cleaned)) {
    throw new Error('رقم الواتساب غير صالح - يجب أن يبدأ بـ +218');
  }
  
  return cleaned;
}

// ======================== LICENSE VALIDATION ========================

/**
 * Validate license data
 * Returns { valid: boolean, errors: string[], data: object }
 */
function validateLicense(data, isUpdate = false) {
  const errors = [];
  const cleanData = {};
  
  // Client Name
  const clientName = sanitize(data.clientName);
  if (isEmpty(clientName)) {
    errors.push('اسم العميل مطلوب');
  } else if (clientName.length < 3) {
    errors.push('اسم العميل يجب أن يكون 3 أحرف على الأقل');
  } else {
    cleanData.clientName = clientName;
  }
  
  // WhatsApp
  try {
    cleanData.whatsapp = normalizeWhatsapp(data.whatsapp);
  } catch (e) {
    errors.push(e.message);
  }
  
  // Subscription Type
  const subscriptionType = sanitize(data.subscriptionType);
  if (isEmpty(subscriptionType)) {
    errors.push('نوع الاشتراك مطلوب');
  } else if (!isValidSubscriptionType(subscriptionType)) {
    errors.push('نوع الاشتراك غير صالح');
  } else {
    cleanData.subscriptionType = subscriptionType;
  }
  
  // Start Date
  const startDate = new Date(data.startDate);
  if (isNaN(startDate.getTime())) {
    errors.push('تاريخ البداية غير صالح');
  } else {
    cleanData.startDate = startDate;
  }
  
  // End Date
  const endDate = new Date(data.endDate);
  if (isNaN(endDate.getTime())) {
    errors.push('تاريخ الانتهاء غير صالح');
  } else {
    cleanData.endDate = endDate;
  }
  
  // Date comparison
  if (cleanData.startDate && cleanData.endDate) {
    if (cleanData.startDate >= cleanData.endDate) {
      errors.push('تاريخ البداية يجب أن يكون قبل تاريخ الانتهاء');
    }
  }
  
  // Notes (optional)
  cleanData.notes = sanitize(data.notes || '');
  
  // Manual Status (only for Admin/Manager on update)
  if (isUpdate && data.status) {
    const status = sanitize(data.status);
    if (['Suspended', 'Inactive'].includes(status)) {
      if (canChangeToStatus(status)) {
        cleanData.manualStatus = status;
      } else {
        errors.push('غير مصرح لك بتغيير الحالة');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    data: cleanData
  };
}

// ======================== STATUS CALCULATION ========================

/**
 * Calculate license status based on dates
 * 
 * Priority:
 * 1. If end date passed → Expired (always)
 * 2. If manually set to Suspended/Inactive → keep it
 * 3. If today < start date → Pending
 * 4. If today between start & end → Active
 */
function calculateStatus(startDate, endDate, currentStatus = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  // Priority 1: Expired always wins
  if (today > end) {
    return 'Expired';
  }
  
  // Priority 2: Manual override (Suspended/Inactive)
  if (currentStatus && ['Suspended', 'Inactive'].includes(currentStatus)) {
    return currentStatus;
  }
  
  // Priority 3: Pending (before start)
  if (today < start) {
    return 'Pending';
  }
  
  // Priority 4: Active
  return 'Active';
}

// ======================== DUPLICATE CHECK ========================

/**
 * Check if WhatsApp number already exists (for another client)
 */
function isWhatsappDuplicate(whatsapp, excludeId = null) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.LICENSES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowId = row[CONFIG.LICENSE_COLUMNS.ID];
      const rowWhatsapp = row[CONFIG.LICENSE_COLUMNS.WHATSAPP];
      const notes = row[CONFIG.LICENSE_COLUMNS.NOTES] || '';
      
      // Skip deleted rows
      if (notes.includes('DELETED')) continue;
      
      // Skip current record on update
      if (excludeId && rowId === excludeId) continue;
      
      if (rowWhatsapp === whatsapp) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('isWhatsappDuplicate Error:', error);
    return false;
  }
}
