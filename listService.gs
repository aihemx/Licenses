/**
 * نظام إدارة التراخيص - List Service
 * قراءة القوائم الديناميكية من شيت Lists
 */

// ======================== GET LISTS ========================

/**
 * Get all items of a specific type
 * Only returns Active items
 */
function getListByType(type) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.LISTS);
    const data = sheet.getDataRange().getValues();
    
    const items = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const itemType = row[CONFIG.LIST_COLUMNS.TYPE];
      const itemStatus = row[CONFIG.LIST_COLUMNS.STATUS];
      const itemValue = row[CONFIG.LIST_COLUMNS.VALUE];
      
      if (itemType === type && itemStatus === 'Active') {
        items.push(itemValue);
      }
    }
    
    return items;
    
  } catch (error) {
    console.error('getListByType Error:', error);
    return [];
  }
}

/**
 * Get subscription types
 */
function getSubscriptionTypes() {
  return getListByType('SubscriptionType');
}

/**
 * Get license statuses
 */
function getLicenseStatuses() {
  return getListByType('LicenseStatus');
}

/**
 * Get all lists for frontend
 */
function getAllLists() {
  try {
    return successResponse({
      subscriptionTypes: getSubscriptionTypes(),
      licenseStatuses: getLicenseStatuses()
    });
    
  } catch (error) {
    console.error('getAllLists Error:', error);
    return errorResponse(error.message);
  }
}

// ======================== VALIDATE LIST VALUE ========================

/**
 * Check if value exists in a list
 */
function isValidListValue(type, value) {
  const items = getListByType(type);
  return items.includes(value);
}

/**
 * Check if subscription type is valid
 */
function isValidSubscriptionType(value) {
  return isValidListValue('SubscriptionType', value);
}

/**
 * Check if license status is valid
 */
function isValidLicenseStatus(value) {
  return isValidListValue('LicenseStatus', value);
}

// ======================== MANAGE LISTS (Admin Only) ========================

/**
 * Add new list item
 */
function addListItem(type, value) {
  try {
    requireRole([ROLES.ADMIN]);
    
    if (isEmpty(type) || isEmpty(value)) {
      return errorResponse('النوع والقيمة مطلوبان');
    }
    
    // Check if already exists
    if (isValidListValue(type, value)) {
      return errorResponse('هذه القيمة موجودة مسبقاً');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.LISTS);
    
    const newItem = [
      generateId(),
      sanitize(type),
      sanitize(value),
      'Active'
    ];
    
    sheet.appendRow(newItem);
    
    logAction('ADD_LIST_ITEM', { type, value });
    
    return successResponse(null, 'تمت الإضافة بنجاح');
    
  } catch (error) {
    console.error('addListItem Error:', error);
    return errorResponse(error.message);
  }
}

/**
 * Deactivate list item (don't delete)
 */
function deactivateListItem(id) {
  try {
    requireRole([ROLES.ADMIN]);
    
    const sheet = getSheet(CONFIG.SHEETS.LISTS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][CONFIG.LIST_COLUMNS.ID] === id) {
        sheet.getRange(i + 1, CONFIG.LIST_COLUMNS.STATUS + 1).setValue('Inactive');
        
        logAction('DEACTIVATE_LIST_ITEM', { id });
        
        return successResponse(null, 'تم التعطيل بنجاح');
      }
    }
    
    return errorResponse('العنصر غير موجود');
    
  } catch (error) {
    console.error('deactivateListItem Error:', error);
    return errorResponse(error.message);
  }
}
