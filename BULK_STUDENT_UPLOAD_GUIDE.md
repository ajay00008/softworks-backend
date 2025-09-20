# Bulk Student Upload Guide

This guide explains how to use the bulk student upload feature to create multiple students at once using a CSV file.

## API Endpoint

**POST** `/api/admin/students/bulk-upload`

**Authentication:** Requires Admin or Super Admin role

## CSV File Format

The CSV file must contain the following columns:

### Required Columns

| Column Name | Description | Example | Validation |
|-------------|-------------|---------|------------|
| `email` | Student's email address | `john.doe@example.com` | Must be a valid email format |
| `password` | Student's password | `password123` | Minimum 8 characters |
| `name` | Student's full name | `John Doe` | Minimum 2 characters |
| `rollNumber` | Student's roll number | `001` | Required, must be unique within class |
| `className` | Class name | `10A` | Must match existing class name (e.g., 10A, 10B, 11A, 12A) |

### Optional Columns

| Column Name | Description | Example | Validation |
|-------------|-------------|---------|------------|
| `fatherName` | Father's name | `Robert Doe` | Optional |
| `motherName` | Mother's name | `Jane Doe` | Optional |
| `dateOfBirth` | Date of birth | `2008-05-15` | Format: YYYY-MM-DD or empty |
| `parentsPhone` | Parent's phone number | `9876543210` | Optional |
| `parentsEmail` | Parent's email | `robert.doe@example.com` | Must be valid email if provided |
| `address` | Student's address | `123 Main St` | Optional |

## Available Classes

The following classes are available in the system:

- **10A** - Class 10A (Grade 10 Section A)
- **10B** - Class 10B (Grade 10 Section B)
- **11A** - Class 11A (Grade 11 Section A)
- **12A** - Class 12A (Grade 12 Section A)

## CSV Example

```csv
email,password,name,rollNumber,className,fatherName,motherName,dateOfBirth,parentsPhone,parentsEmail,address
john.doe@example.com,password123,John Doe,001,10A,Robert Doe,Jane Doe,2008-05-15,9876543210,robert.doe@example.com,123 Main St
jane.smith@example.com,password123,Jane Smith,002,10A,Michael Smith,Sarah Smith,,9876543211,sarah.smith@example.com,456 Oak Ave
alice.johnson@example.com,password123,Alice Johnson,001,10B,David Johnson,Lisa Johnson,2008-03-10,9876543212,lisa.johnson@example.com,789 Pine Rd
```

## Request Format

Send a POST request with `multipart/form-data` content type:

```bash
curl -X POST \
  http://localhost:3000/api/admin/students/bulk-upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@students.csv"
```

## Response Format

### Success Response (201)

```json
{
  "success": true,
  "message": "Successfully processed 3 students",
  "data": {
    "totalRows": 3,
    "created": 3,
    "errors": 0,
    "students": [
      {
        "id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "rollNumber": "001",
        "className": "10A",
        "classDisplayName": "Class 10A",
        "isActive": true,
        "rowNumber": 2
      }
    ]
  }
}
```

### Error Response (400)

```json
{
  "success": false,
  "message": "Validation errors found in CSV file",
  "errors": [
    {
      "row": 2,
      "errors": [
        "email: Invalid email format",
        "password: Password must be at least 8 characters"
      ]
    }
  ],
  "totalRows": 3,
  "errorRows": 1,
  "validRows": 2
}
```

## Validation Rules

1. **Email Uniqueness**: Each email must be unique across the entire system
2. **Roll Number Uniqueness**: Each roll number must be unique within the same class
3. **Class Existence**: The className must match an existing active class
4. **Password Strength**: Minimum 8 characters
5. **Date Format**: Date of birth must be in YYYY-MM-DD format
6. **Email Format**: All email fields must be valid email addresses

## Error Handling

The system performs comprehensive validation:

1. **File Validation**: Only CSV files are accepted (5MB limit)
2. **Header Validation**: All required headers must be present
3. **Row Validation**: Each row is validated individually
4. **Database Validation**: Checks for existing emails and roll numbers
5. **Class Validation**: Verifies class existence and active status

## Best Practices

1. **Test with Small Files**: Start with a small CSV file to test the format
2. **Backup Data**: Always backup existing data before bulk uploads
3. **Validate Classes**: Ensure all classes referenced in the CSV exist
4. **Check Roll Numbers**: Verify roll numbers are unique within each class
5. **Email Uniqueness**: Ensure all emails are unique across the system

## Troubleshooting

### Common Issues

1. **"Class not found"**: Verify the className matches exactly (case-sensitive)
2. **"Email already exists"**: Check if the email is already in the system
3. **"Roll number already exists"**: Ensure roll numbers are unique within each class
4. **"Invalid email format"**: Check email format and ensure no extra spaces
5. **"Password too short"**: Ensure passwords are at least 8 characters

### File Issues

1. **"CSV file is required"**: Ensure the file is uploaded with the correct field name 'file'
2. **"Only CSV files are allowed"**: Ensure the file has .csv extension
3. **"File too large"**: Reduce file size (5MB limit)

## Sample Files

A sample CSV file (`sample-students.csv`) is provided in the project root for reference.
