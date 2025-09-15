# Student Data Migration Guide

This guide explains how to migrate existing student data from the old `className` (string) format to the new `classId` (ObjectId reference) format.

## Overview

The student data structure has been updated to use proper database references:
- **Old format**: `className: string` (e.g., "11A", "12B")
- **New format**: `classId: ObjectId` (references the Class collection)

## Migration Steps

### 1. Check Current Data State

First, check what data needs to be migrated:

```bash
npm run check-student-data
```

This will show you:
- How many students have `className` vs `classId`
- Which class names exist and which don't
- Any data inconsistencies

### 2. Run the Migration

If students with `className` are found, run the migration:

```bash
npm run migrate-student-class
```

This script will:
- Find all students with `className` field
- Match class names to existing Class records
- Create missing classes if needed
- Update students to use `classId` instead of `className`
- Remove the old `className` field

### 3. Verify Migration

After running the migration, check the results:

```bash
npm run check-student-data
```

You should see:
- 0 students with `className`
- All students now have `classId`
- No data inconsistencies

## Migration Details

### Class Name Matching

The migration script tries to match class names in this order:

1. **Exact match**: Direct match with existing class names
2. **Display name match**: Match with class display names
3. **Pattern matching**: Extract level and section from patterns like "11A" → level 11, section A

### Auto-Creation of Missing Classes

If a class doesn't exist for a student's `className`, the script will:
- Try to extract level and section from the class name
- Create a new class with default values
- Set academic year to "2024-25" (you can modify this)
- Mark the class as active

### Error Handling

The migration script handles errors gracefully:
- Logs all errors for review
- Continues processing even if some students fail
- Provides a detailed summary at the end

## Manual Review

After migration, you may need to:

1. **Review auto-created classes**: Check if the default values are correct
2. **Update academic years**: Set the correct academic year for classes
3. **Fix any remaining issues**: Address any students that couldn't be migrated

## Rollback (if needed)

If you need to rollback the migration:

```javascript
// This would need to be run manually in MongoDB
db.students.updateMany(
  { classId: { $exists: true } },
  [
    {
      $set: {
        className: { $toString: "$classId" } // This won't work directly
      }
    }
  ]
);
```

**Note**: Rollback is complex because we need to convert ObjectId back to class names. It's recommended to backup your data before migration.

## API Changes

After migration, the API responses will change:

### Before (className format):
```json
{
  "rollNumber": "11A001",
  "className": "11A"
}
```

### After (classId format):
```json
{
  "rollNumber": "11A001",
  "class": {
    "id": "64a1b2c3d4e5f6789abcdef0",
    "name": "11A",
    "displayName": "Class 11A",
    "level": 11,
    "section": "A",
    "academicYear": "2024-25"
  }
}
```

## Troubleshooting

### Common Issues

1. **"No matching class found"**: The class name doesn't match any existing class
   - Solution: Check if the class exists or create it manually

2. **"Invalid class name format"**: The class name doesn't follow expected patterns
   - Solution: Manually update the student record

3. **"Class already exists"**: Duplicate class names
   - Solution: Check for duplicate classes and merge if needed

### Getting Help

If you encounter issues:
1. Check the migration logs for specific error messages
2. Verify your Class collection has the expected data
3. Ensure MongoDB connection is working
4. Check that all required fields are present

## Next Steps

After successful migration:
1. Update your frontend to use the new API response format
2. Test all student-related functionality
3. Update any documentation or examples
4. Consider running the general data consistency check: `npm run migrate`
