/**
 * نظام إدارة التراخيص - License Management System
 * Main Entry Point
 */

// ======================== CONFIGURATION ========================
const CONFIG = {
  // ⚠️ استبدل هذا بـ ID الخاص بـ Spreadsheet
  SPREADSHEET_ID: '1FCkytHRhu3d-2faOsls2uTBJjhLSGtPKPc4hELb7qBI',
  
  // أسماء الـ Sheets
  SHEETS: {
    LICENSES: 'Licenses',
    USERS: 'Users',
    LISTS: 'Lists'
  },
  
  // أعمدة Licenses
  LICENSE_COLUMNS: {
    ID: 0,
    CLIENT_NAME: 1,
    WHATSAPP: 2,
    SUBSCRIPTION_TYPE: 3,
    STATUS: 4,
    START_DATE: 5,
    END_DATE: 6,
    DURATION: 7,
    REMAINING: 8,
    CREATED_AT: 9,
    CREATED_BY: 10,
    UPDATED_AT: 11,
    UPDATED_BY: 12,
    LAST_CHECKED: 13,
    NOTES: 14
  },
  
  // أعمدة Users
  USER_COLUMNS: {
    EMAIL: 0,
    FULL_NAME: 1,
    ROLE: 2,
    STATUS: 3,
    CREATED_AT: 4,
    LAST_LOGIN: 5
  },
  
  // أعمدة Lists
  LIST_COLUMNS: {
    ID: 0,
    TYPE: 1,
    VALUE: 2,
    STATUS: 3
  }
};

// ======================== WEB APP ENTRY ========================

/**
 * GET Request Handler - نقطة الدخول للـ Web App
 */
function doGet(e) {
  try {
    // التحقق من المستخدم
    const user = getCurrentUser();
    
    if (!user) {
      return HtmlService.createHtmlOutput(`
        <html dir="rtl">
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a2e; color: #fff; margin: 0; }
              .error-box { text-align: center; padding: 40px; background: #16213e; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
              h1 { color: #e94560; margin-bottom: 16px; }
              p { color: #a0a0a0; }
            </style>
          </head>
          <body>
            <div class="error-box">
              <h1>⛔ غير مصرح</h1>
              <p>ليس لديك صلاحية للوصول إلى هذا النظام.</p>
              <p>تواصل مع المسؤول لإضافة حسابك.</p>
            </div>
          </body>
        </html>
      `).setTitle('غير مصرح');
    }
    
    if (user.status !== 'Active') {
      return HtmlService.createHtmlOutput(`
        <html dir="rtl">
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a2e; color: #fff; margin: 0; }
              .error-box { text-align: center; padding: 40px; background: #16213e; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
              h1 { color: #f39c12; margin-bottom: 16px; }
              p { color: #a0a0a0; }
            </style>
          </head>
          <body>
            <div class="error-box">
              <h1>⚠️ الحساب معطل</h1>
              <p>تم تعطيل حسابك. تواصل مع المسؤول.</p>
            </div>
          </body>
        </html>
      `).setTitle('حساب معطل');
    }
    
    // تحديث آخر دخول
    updateLastLogin(user.email);
    
    // عرض الصفحة الرئيسية
    const template = HtmlService.createTemplateFromFile('index');
    template.user = user;
    
    return template.evaluate()
      .setTitle('نظام إدارة التراخيص')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      
  } catch (error) {
    console.error('doGet Error:', error);
    return HtmlService.createHtmlOutput(`
      <html dir="rtl">
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>❌ خطأ في النظام</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
}

/**
 * Include HTML files (for CSS/JS)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ======================== SPREADSHEET ACCESS ========================

/**
 * Get Spreadsheet
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get Sheet by name
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

// ======================== DAILY TRIGGER SETUP ========================

/**
 * Setup Daily Trigger - يتم تشغيله مرة واحدة فقط
 */
function setupDailyTrigger() {
  // حذف التريجرات القديمة
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkLicenses') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // إنشاء تريجر جديد - كل يوم الساعة 6 صباحاً
  ScriptApp.newTrigger('checkLicenses')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
    
  console.log('✅ Daily trigger created successfully');
}

/**
 * Initialize Spreadsheet with Headers
 * يتم تشغيله مرة واحدة عند الإعداد
 */
function initializeSpreadsheet() {
  const ss = getSpreadsheet();
  
  // Licenses Sheet
  let licensesSheet = ss.getSheetByName(CONFIG.SHEETS.LICENSES);
  if (!licensesSheet) {
    licensesSheet = ss.insertSheet(CONFIG.SHEETS.LICENSES);
  }
  licensesSheet.getRange(1, 1, 1, 15).setValues([[
    'ID', 'Client Name', 'Whatsapp Number', 'Subscription Type', 'Status',
    'Start Date', 'End Date', 'Duration (Days)', 'Remaining Days',
    'Created At', 'Created By', 'Updated At', 'Updated By', 'Last Checked', 'Notes'
  ]]);
  
  // Users Sheet
  let usersSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(CONFIG.SHEETS.USERS);
  }
  usersSheet.getRange(1, 1, 1, 6).setValues([[
    'Email', 'Full Name', 'Role', 'Status', 'Created At', 'Last Login'
  ]]);
  
  // Lists Sheet
  let listsSheet = ss.getSheetByName(CONFIG.SHEETS.LISTS);
  if (!listsSheet) {
    listsSheet = ss.insertSheet(CONFIG.SHEETS.LISTS);
  }
  listsSheet.getRange(1, 1, 1, 4).setValues([[
    'ID', 'Type', 'Value', 'Status'
  ]]);
  
  // إضافة بيانات افتراضية للـ Lists
  const defaultLists = [
    [Utilities.getUuid(), 'SubscriptionType', 'شهري', 'Active'],
    [Utilities.getUuid(), 'SubscriptionType', 'ربع سنوي', 'Active'],
    [Utilities.getUuid(), 'SubscriptionType', 'نصف سنوي', 'Active'],
    [Utilities.getUuid(), 'SubscriptionType', 'سنوي', 'Active'],
    [Utilities.getUuid(), 'LicenseStatus', 'Active', 'Active'],
    [Utilities.getUuid(), 'LicenseStatus', 'Pending', 'Active'],
    [Utilities.getUuid(), 'LicenseStatus', 'Expired', 'Active'],
    [Utilities.getUuid(), 'LicenseStatus', 'Suspended', 'Active'],
    [Utilities.getUuid(), 'LicenseStatus', 'Inactive', 'Active']
  ];
  
  if (listsSheet.getLastRow() < 2) {
    listsSheet.getRange(2, 1, defaultLists.length, 4).setValues(defaultLists);
  }
  
  console.log('✅ Spreadsheet initialized successfully');
}
