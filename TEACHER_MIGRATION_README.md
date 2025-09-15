# Teacher Database Migration Guide

This guide explains how to update existing teachers in the database to include the new `classIds` field and remove the deprecated `department` field.

## 🎯 What This Migration Does

### ✅ **Adds New Features:**
- **`classIds` field**: Allows teachers to be assigned to multiple classes
- **Enhanced teacher-class relationships**: Direct assignment of teachers to specific classes
- **Backward compatibility**: Existing subject-based logic still works

### 🗑️ **Removes Deprecated Features:**
- **`department` field**: Removed from Teacher model and all related code
- **Department-based queries**: Removed department filtering and search

## 📋 Migration Options

### 1. **Basic Migration** (Recommended)
```bash
node run-teacher-migration.js basic
```
- Adds empty `classIds` array to all teachers
- Removes `department` field from all teachers
- Safe and quick

### 2. **Migration with Class Assignment**
```bash
node run-teacher-migration.js with-classes
```
- Does everything from basic migration
- **Automatically assigns classes** to teachers based on their subjects
- Teachers get assigned to classes that match their subject levels

### 3. **Dry Run** (Preview Changes)
```bash
node run-teacher-migration.js dry-run
```
- Shows what changes would be made without actually applying them
- Safe way to preview the migration

## 🔧 Manual Migration Scripts

You can also run the TypeScript scripts directly:

```bash
# Basic migration
npx tsx src/scripts/migrateTeachersWithClasses.ts basic

# Migration with class assignment
npx tsx src/scripts/migrateTeachersWithClasses.ts with-classes

# Dry run
npx tsx src/scripts/migrateTeachersWithClasses.ts dry-run
```

## 📊 What Gets Updated

### **Database Changes:**
- All existing teachers get `classIds: []` field added
- All existing teachers have `department` field removed
- Optional: Teachers get assigned to compatible classes based on subjects

### **API Changes:**
- ✅ **New Endpoints:**
  - `PATCH /api/admin/teachers/:id/classes` - Assign classes to teacher
  - `GET /api/admin/teachers/:teacherId/assigned-classes` - Get assigned classes only
  - `GET /api/admin/teachers/:teacherId/classes` - Get all classes (assigned + compatible)

- ✅ **Enhanced Endpoints:**
  - `POST /api/admin/teachers` - Now accepts `classIds` array
  - `PUT /api/admin/teachers/:id` - Now accepts `classIds` array  
  - `GET /api/admin/teachers` - Now returns class information
  - `GET /api/admin/teachers/:id` - Now returns class information

- ❌ **Removed Endpoints:**
  - `GET /api/admin/teachers/department/:department` - Department field removed

## 🚀 Migration Steps

### **Step 1: Backup Your Database**
```bash
# Create a backup before migration
mongodump --uri="your-mongodb-connection-string" --out=backup-$(date +%Y%m%d)
```

### **Step 2: Run Dry Run (Optional but Recommended)**
```bash
node run-teacher-migration.js dry-run
```
This will show you exactly what changes will be made without applying them.

### **Step 3: Run Migration**
Choose one of these options:

**Option A: Basic Migration (Safe)**
```bash
node run-teacher-migration.js basic
```

**Option B: Migration with Automatic Class Assignment**
```bash
node run-teacher-migration.js with-classes
```

### **Step 4: Verify Migration**
The migration script will automatically show you:
- Number of teachers updated
- Sample of updated teachers
- Verification statistics

## 📋 Example Migration Output

```
🔄 Starting teacher migration with class assignment...
✅ Connected to database
📊 Found 25 teachers to migrate

👨‍🏫 Processing teacher: John Smith
   📝 Adding empty classIds array
   🗑️  Removing department field
   📚 Teacher can teach levels: 9, 10, 11, 12
   🎯 Assigning 8 compatible classes
   📋 Classes: 9A (Level 9), 9B (Level 9), 10A (Level 10), 10B (Level 10), 11A (Level 11), 11B (Level 11), 12A (Level 12), 12B (Level 12)
   ✅ Updated teacher

📈 Migration Summary:
✅ Updated: 25 teachers
⏭️  Skipped: 0 teachers
🎯 Classes assigned: 200
📊 Total processed: 25 teachers

📊 Detailed Statistics:
✅ Teachers with classIds field: 25/25
🎯 Teachers with assigned classes: 25/25
✅ Teachers without department field: 25/25

🎉 Teacher migration completed successfully!
```

## 🔍 Post-Migration Verification

After migration, you can verify the changes:

### **Check Teacher Data:**
```bash
# Connect to MongoDB and check teacher documents
db.teachers.find().limit(3).pretty()
```

You should see:
- `classIds` field present (empty array or with class IDs)
- No `department` field

### **Test API Endpoints:**
```bash
# Get all teachers (should include class information)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/admin/teachers

# Get assigned classes for a teacher
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/admin/teachers/TEACHER_ID/assigned-classes

# Assign classes to a teacher
curl -X PATCH -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"classIds": ["CLASS_ID_1", "CLASS_ID_2"]}' \
  http://localhost:3000/api/admin/teachers/TEACHER_ID/classes
```

## ⚠️ Important Notes

1. **Backup First**: Always backup your database before running migrations
2. **Test Environment**: Run migration on test environment first if possible
3. **Downtime**: The migration should be quick, but consider running during low-traffic periods
4. **Rollback**: If needed, you can restore from backup to rollback changes

## 🆘 Troubleshooting

### **Migration Fails:**
- Check MongoDB connection string
- Ensure database is accessible
- Check for any existing data conflicts

### **Teachers Not Getting Classes:**
- Verify that subjects have correct `level` field
- Ensure classes exist and are active
- Check subject-class level compatibility

### **API Errors After Migration:**
- Restart your application server
- Clear any cached data
- Verify all routes are properly updated

## 📞 Support

If you encounter issues during migration:
1. Check the migration output for specific error messages
2. Verify your database connection and permissions
3. Ensure all required models and dependencies are properly installed
4. Consider running the dry-run first to identify potential issues

---

**Migration completed successfully!** 🎉

Your teachers now support multiple class assignments and the deprecated department field has been removed.
