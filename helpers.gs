/**
 * نظام إدارة التراخيص - Helper Functions
 */

// ======================== ID GENERATION ========================

/**
 * Generate UUID
 */
function generateId() {
  return Utilities.getUuid();
}

// ======================== DATE HELPERS ========================

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date to Arabic format
 */
function formatDateArabic(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('ar-LY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get current timestamp
 */
function getCurrentTimestamp() {
  return new Date();
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Reset time component
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calculate remaining days from today to end date
 */
function calculateRemainingDays(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  const remaining = daysBetween(today, end);
  return Math.max(0, remaining);
}

/**
 * Calculate duration between start and end date
 */
function calculateDuration(startDate, endDate) {
  return daysBetween(startDate, endDate);
}

// ======================== STRING HELPERS ========================

/**
 * Sanitize input - remove harmful characters
 */
function sanitize(input) {
  if (input === null || input === undefined) return '';
  
  return String(input)
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, ''); // Remove special chars
}

/**
 * Check if string is empty or whitespace
 */
function isEmpty(str) {
  return !str || String(str).trim().length === 0;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ======================== RESPONSE HELPERS ========================

/**
 * Create success response
 */
function successResponse(data, message = 'تمت العملية بنجاح') {
  return {
    success: true,
    message: message,
    data: data
  };
}

/**
 * Create error response
 */
function errorResponse(message, code = 'ERROR') {
  return {
    success: false,
    message: message,
    error: code
  };
}

// ======================== ARRAY HELPERS ========================

/**
 * Find row index by ID in 2D array
 */
function findRowIndexById(data, id, idColumn = 0) {
  for (let i = 0; i < data.length; i++) {
    if (data[i][idColumn] === id) {
      return i;
    }
  }
  return -1;
}

/**
 * Convert row array to license object
 */
function rowToLicense(row) {
  const cols = CONFIG.LICENSE_COLUMNS;
  return {
    id: row[cols.ID],
    clientName: row[cols.CLIENT_NAME],
    whatsapp: row[cols.WHATSAPP],
    subscriptionType: row[cols.SUBSCRIPTION_TYPE],
    status: row[cols.STATUS],
    startDate: formatDate(row[cols.START_DATE]),
    endDate: formatDate(row[cols.END_DATE]),
    duration: row[cols.DURATION],
    remaining: row[cols.REMAINING],
    createdAt: row[cols.CREATED_AT],
    createdBy: row[cols.CREATED_BY],
    updatedAt: row[cols.UPDATED_AT],
    updatedBy: row[cols.UPDATED_BY],
    lastChecked: row[cols.LAST_CHECKED],
    notes: row[cols.NOTES]
  };
}

/**
 * Convert license object to row array
 */
function licenseToRow(license) {
  return [
    license.id,
    license.clientName,
    license.whatsapp,
    license.subscriptionType,
    license.status,
    license.startDate,
    license.endDate,
    license.duration,
    license.remaining,
    license.createdAt,
    license.createdBy,
    license.updatedAt,
    license.updatedBy,
    license.lastChecked,
    license.notes
  ];
}

/**
 * Convert row array to user object
 */
function rowToUser(row) {
  const cols = CONFIG.USER_COLUMNS;
  return {
    email: row[cols.EMAIL],
    fullName: row[cols.FULL_NAME],
    role: row[cols.ROLE],
    status: row[cols.STATUS],
    createdAt: row[cols.CREATED_AT],
    lastLogin: row[cols.LAST_LOGIN]
  };
}

// ======================== LOGGING ========================

/**
 * Log action for audit trail
 */
function logAction(action, details) {
  console.log(`[${new Date().toISOString()}] ${action}:`, JSON.stringify(details));
}
