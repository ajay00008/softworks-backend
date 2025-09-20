# Bulk Teacher Upload Guide

This guide explains how to use the bulk teacher upload feature in the School Management System.

## Overview

The bulk teacher upload feature allows administrators to upload multiple teachers at once using a CSV file. This is similar to the student bulk upload functionality but specifically designed for teacher data.

## API Endpoint

```
POST /api/admin/teachers/bulk-upload
```

**Authentication Required:** Yes (Admin or Super Admin role)

**Content-Type:** `multipart/form-data`

## CSV File Format

### Required Headers

The CSV file must contain the following headers:

- `email` (required) - Teacher's email address
- `password` (required) - Teacher's password (minimum 8 characters)
- `name` (required) - Teacher's full name

### Optional Headers

- `qualification` - Teacher's educational qualification
- `experience` - Years of teaching experience (numeric)
- `phone` - Teacher's phone number
- `address` - Teacher's address

### Sample CSV File

```csv
email,password,name,qualification,experience,phone,address
john.teacher@example.com,password123,John Smith,M.Sc Mathematics,5,9876543210,123 Teacher Lane
jane.doe@example.com,password123,Jane Doe,B.Ed English,3,9876543211,456 Education Street
mike.wilson@example.com,password123,Mike Wilson,M.A Physics,7,9876543212,789 Science Avenue
sarah.johnson@example.com,password123,Sarah Johnson,B.Sc Chemistry,4,9876543213,321 Lab Road
david.brown@example.com,password123,David Brown,M.A History,6,9876543214,654 History Street
lisa.garcia@example.com,password123,Lisa Garcia,B.Ed Biology,2,9876543215,987 Biology Lane
tom.miller@example.com,password123,Tom Miller,M.Sc Computer Science,8,9876543216,147 Tech Street
emma.davis@example.com,password123,Emma Davis,B.A Geography,3,9876543217,258 Geography Avenue
```

## Usage

### Using cURL

```bash
curl -X POST http://localhost:4000/api/admin/teachers/bulk-upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample-teachers.csv"
```

### Using JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch('/api/admin/teachers/bulk-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
```

## Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Successfully processed 8 teachers",
  "data": {
    "totalRows": 8,
    "created": 8,
    "errors": 0,
    "teachers": [
      {
        "id": "68ce2ba67ae35f5db219b4f4",
        "email": "john.teacher@example.com",
        "name": "John Smith",
        "qualification": "M.Sc Mathematics",
        "experience": 5,
        "phone": "9876543210",
        "address": "123 Teacher Lane",
        "isActive": true,
        "rowNumber": 2
      }
      // ... more teachers
    ]
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "message": "Validation errors found in CSV file",
  "errors": [
    {
      "row": 3,
      "errors": ["email: Invalid email format"]
    }
  ],
  "totalRows": 8,
  "errorRows": 1,
  "validRows": 7
}
```

## Validation Rules

### Email Validation
- Must be a valid email format
- Must be unique (not already exists in database)
- Must be unique within the same batch

### Password Validation
- Minimum 8 characters
- No maximum length limit

### Name Validation
- Minimum 2 characters
- No maximum length limit

### Experience Validation
- Must be a valid number if provided
- Automatically converted from string to number

### Optional Fields
- Empty values are allowed for optional fields
- Empty strings are treated as undefined/null

## Error Handling

The system provides comprehensive error handling:

1. **File Validation**: Checks if CSV file is provided and valid
2. **Header Validation**: Ensures required headers are present
3. **Row Validation**: Validates each row against schema
4. **Duplicate Detection**: Prevents duplicate emails within batch and database
5. **Transaction Safety**: Uses database transactions to ensure data consistency

## Teacher Creation Process

1. **User Account Creation**: Creates a User record with role "TEACHER"
2. **Teacher Profile Creation**: Creates a Teacher record linked to the User
3. **Default Permissions**: Sets default permissions (all false)
4. **Subject/Class Assignment**: Teachers are created without subjects/classes initially
   - Subjects and classes can be assigned later using the assignment endpoints

## Post-Upload Actions

After successful bulk upload, teachers will need:

1. **Subject Assignment**: Use `/api/admin/teachers/{id}/subjects` endpoint
2. **Class Assignment**: Use `/api/admin/teachers/{id}/classes` endpoint
3. **Permission Configuration**: Use `/api/admin/teachers/{id}/permissions` endpoint

## Best Practices

1. **CSV Preparation**:
   - Use UTF-8 encoding
   - Ensure no empty rows
   - Validate email formats before upload
   - Use consistent data formats

2. **Testing**:
   - Test with a small batch first
   - Verify data integrity after upload
   - Check for any validation errors

3. **Security**:
   - Use strong passwords
   - Ensure proper authentication
   - Validate file size (5MB limit)

## File Size Limits

- Maximum file size: 5MB
- Recommended batch size: 100-500 teachers per upload
- For larger batches, consider splitting into multiple files

## Troubleshooting

### Common Issues

1. **"Missing required headers"**: Ensure CSV has email, password, and name columns
2. **"Email already in use"**: Check for duplicate emails in database or batch
3. **"Invalid email format"**: Verify email addresses are properly formatted
4. **"Password must be at least 8 characters"**: Ensure all passwords meet minimum length

### Debug Tips

1. Check the response for detailed error information
2. Verify CSV file format and encoding
3. Ensure authentication token is valid
4. Check server logs for additional details

## Integration with Existing Features

The bulk teacher upload integrates seamlessly with:

- Individual teacher management endpoints
- Subject assignment functionality
- Class assignment functionality
- Permission management system
- Teacher dashboard and data access

## Sample Files

A sample CSV file (`sample-teachers.csv`) is provided in the project root for reference and testing.
