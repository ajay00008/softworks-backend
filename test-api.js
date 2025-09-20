// Simple API test script for School Management System
// Run with: node test-api.js

const BASE_URL = 'http://localhost:4000/api';

// Test data
const testData = {
  superAdmin: {
    email: 'super@softworks.local',
    password: 'ChangeMe123!'
  },
  admin: {
    email: 'admin@school.com',
    password: 'admin123',
    name: 'School Admin'
  },
  student: {
    email: 'student@school.com',
    password: 'student123',
    name: 'John Doe',
    rollNumber: '11A001',
    className: '11th A',
    fatherName: 'Robert Doe',
    motherName: 'Jane Doe',
    parentsPhone: '+1234567890',
    parentsEmail: 'parents@email.com'
  },
  teacher: {
    email: 'teacher@school.com',
    password: 'teacher123',
    name: 'Jane Smith',
    subjectIds: ['math', 'physics'],
    qualification: 'M.Sc Mathematics',
    experience: 5,
    department: 'Science'
  },
  teacherWithoutSubjects: {
    email: 'teacher2@school.com',
    password: 'teacher123',
    name: 'John Doe',
    subjectIds: [],
    classIds: [],
    qualification: 'B.Ed',
    experience: 3,
    department: 'General'
  }
};

let authToken = '';

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    console.log(`${method} ${endpoint}: ${response.status}`);
    if (!response.ok) {
      console.error('Error:', result);
    } else {
      console.log('Success:', result);
    }
    return { response, result };
  } catch (error) {
    console.error('Network error:', error.message);
    return { response: null, result: null, error };
  }
}

// Test functions
async function testLogin() {
  console.log('\n=== Testing Login ===');
  const { result } = await apiCall('POST', '/auth/login', testData.superAdmin);
  if (result && result.token) {
    authToken = result.token;
    console.log('Login successful, token received');
  }
}

async function testCreateAdmin() {
  console.log('\n=== Testing Create Admin ===');
  await apiCall('POST', '/super/admins', testData.admin, authToken);
}

async function testGetAdmins() {
  console.log('\n=== Testing Get Admins ===');
  await apiCall('GET', '/super/admins', null, authToken);
}

async function testCreateStudent() {
  console.log('\n=== Testing Create Student ===');
  await apiCall('POST', '/admin/students', testData.student, authToken);
}

async function testCreateTeacher() {
  console.log('\n=== Testing Create Teacher ===');
  await apiCall('POST', '/admin/teachers', testData.teacher, authToken);
}

async function testCreateTeacherWithoutSubjects() {
  console.log('\n=== Testing Create Teacher Without Subjects/Classes ===');
  await apiCall('POST', '/admin/teachers', testData.teacherWithoutSubjects, authToken);
}

async function testGetStudents() {
  console.log('\n=== Testing Get Students ===');
  await apiCall('GET', '/admin/students', null, authToken);
}

async function testGetTeachers() {
  console.log('\n=== Testing Get Teachers ===');
  await apiCall('GET', '/admin/teachers', null, authToken);
}

async function testGetStudentsByClass() {
  console.log('\n=== Testing Get Students by Class ===');
  await apiCall('GET', '/admin/students/class/11th%20A', null, authToken);
}

async function testBulkTeacherUpload() {
  console.log('\n=== Testing Bulk Teacher Upload ===');
  
  // Create FormData for file upload
  const { default: FormData } = await import('form-data');
  const { createReadStream } = await import('fs');
  
  const form = new FormData();
  form.append('file', createReadStream('./sample-teachers.csv'));
  
  try {
    const response = await fetch(`${BASE_URL}/admin/teachers/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    const result = await response.json();
    console.log(`POST /admin/teachers/bulk-upload: ${response.status}`);
    if (!response.ok) {
      console.error('Error:', result);
    } else {
      console.log('Success:', result);
    }
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

async function testHealthCheck() {
  console.log('\n=== Testing Health Check ===');
  await apiCall('GET', '/health');
}

// Main test runner
async function runTests() {
  console.log('Starting API Tests...');
  console.log('Make sure the server is running on http://localhost:4000');
  
  try {
    await testHealthCheck();
    await testLogin();
    
    if (authToken) {
      await testCreateAdmin();
      await testGetAdmins();
      await testCreateStudent();
      await testCreateTeacher();
      await testCreateTeacherWithoutSubjects();
      await testGetStudents();
      await testGetTeachers();
      await testGetStudentsByClass();
      await testBulkTeacherUpload();
    }
    
    console.log('\n=== All Tests Completed ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export {
  apiCall,
  testLogin,
  testCreateAdmin,
  testCreateStudent,
  testCreateTeacher,
  testCreateTeacherWithoutSubjects,
  testGetStudents,
  testGetTeachers,
  testBulkTeacherUpload,
  runTests
};
