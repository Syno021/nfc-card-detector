/**
 * USB RFID Reader Backend Service
 * 
 * This Node.js service bridges USB RFID readers with your React Native app
 * It reads card data from the USB reader and provides HTTP API endpoints
 */

const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');
const bodyParser = require('body-parser');

// Configuration
const CONFIG = {
  PORT: 8081,
  SERIAL_PORT: '/dev/ttyUSB0', // Change based on your system
  BAUD_RATE: 9600,
  CARD_ID_FORMAT: 'hex', // 'hex' or 'decimal'
};

// Initialize Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Store recent card scans (in-memory cache)
const recentScans = new Map();
const SCAN_CACHE_DURATION = 30000; // 30 seconds

// Mock database (replace with actual database)
const studentDatabase = new Map([
  ['04:1A:2B:3C', {
    id: 'STU12345',
    cardNumber: '04:1A:2B:3C',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@university.edu',
    department: 'Computer Science',
    role: 'student',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    validUntil: '2025-06-30T23:59:59Z',
  }],
  ['E0:04:01:50', {
    id: 'STU67890',
    cardNumber: 'E0:04:01:50',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@university.edu',
    department: 'Engineering',
    role: 'student',
    isActive: true,
    createdAt: '2024-02-20T00:00:00Z',
    validUntil: '2025-06-30T23:59:59Z',
  }],
]);

// Initialize Serial Port for USB RFID Reader
let serialPort;
let parser;

function initializeSerialPort() {
  try {
    serialPort = new SerialPort({
      path: CONFIG.SERIAL_PORT,
      baudRate: CONFIG.BAUD_RATE,
      autoOpen: false,
    });

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    serialPort.open((err) => {
      if (err) {
        console.error('❌ Error opening serial port:', err.message);
        console.log('Available ports:');
        listAvailablePorts();
        return;
      }
      console.log('✅ Serial port opened successfully');
      console.log(`📡 Listening for RFID cards on ${CONFIG.SERIAL_PORT}`);
    });

    // Handle incoming card data
    parser.on('data', (rawData) => {
      const cardId = formatCardId(rawData.trim());
      console.log(`🎴 Card detected: ${cardId}`);
      
      // Store in cache
      recentScans.set(cardId, {
        cardId,
        timestamp: Date.now(),
        rawData,
      });
      
      // Clean old scans
      cleanOldScans();
      
      // Emit event (for WebSocket connections, if implemented)
      broadcastCardScan(cardId);
    });

    serialPort.on('error', (err) => {
      console.error('❌ Serial port error:', err.message);
    });

  } catch (error) {
    console.error('❌ Failed to initialize serial port:', error.message);
    console.log('\n💡 Tips:');
    console.log('   - Check USB RFID reader is connected');
    console.log('   - Verify correct port path in CONFIG.SERIAL_PORT');
    console.log('   - On Linux, may need: sudo chmod 666 /dev/ttyUSB0');
    console.log('   - On Windows, check Device Manager for COM port');
  }
}

// List available serial ports
async function listAvailablePorts() {
  try {
    const ports = await SerialPort.list();
    console.log('\n📋 Available Serial Ports:');
    ports.forEach((port, index) => {
      console.log(`   ${index + 1}. ${port.path}`);
      if (port.manufacturer) console.log(`      Manufacturer: ${port.manufacturer}`);
      if (port.serialNumber) console.log(`      Serial: ${port.serialNumber}`);
    });
    console.log('');
  } catch (error) {
    console.error('Error listing ports:', error.message);
  }
}

// Format card ID based on configuration
function formatCardId(rawId) {
  // Remove any whitespace
  let formatted = rawId.replace(/\s+/g, '');
  
  if (CONFIG.CARD_ID_FORMAT === 'hex') {
    // Format as hex with colons (e.g., 04:1A:2B:3C)
    if (formatted.length % 2 === 0) {
      formatted = formatted.match(/.{2}/g).join(':').toUpperCase();
    }
  }
  
  return formatted;
}

// Clean old scans from cache
function cleanOldScans() {
  const now = Date.now();
  for (const [cardId, scan] of recentScans.entries()) {
    if (now - scan.timestamp > SCAN_CACHE_DURATION) {
      recentScans.delete(cardId);
    }
  }
}

// Broadcast card scan (placeholder for WebSocket)
function broadcastCardScan(cardId) {
  // TODO: Implement WebSocket broadcasting if needed
  // For now, just log
  console.log(`   → Broadcasting scan: ${cardId}`);
}

// ====================== API ENDPOINTS ======================

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    serialPort: {
      connected: serialPort && serialPort.isOpen,
      path: CONFIG.SERIAL_PORT,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /recent-scans
 * Get recently scanned cards
 */
app.get('/recent-scans', (req, res) => {
  cleanOldScans();
  res.json({
    scans: Array.from(recentScans.values()),
    count: recentScans.size,
  });
});

/**
 * POST /verify-student-card
 * Verify a student card against database
 */
app.post('/verify-student-card', (req, res) => {
  const { cardId, studentData, timestamp } = req.body;
  
  console.log(`🔍 Verifying card: ${cardId}`);
  
  // Look up student in database
  const student = studentDatabase.get(cardId);
  
  if (!student) {
    console.log('   ❌ Card not found in database');
    return res.json({
      success: false,
      error: 'Card not registered in system',
    });
  }
  
  // Check if student is active
  if (!student.isActive) {
    console.log('   ⚠️  Student account inactive');
    return res.json({
      success: false,
      error: 'Student account is inactive',
    });
  }
  
  // Check validity period
  const now = new Date();
  const validUntil = new Date(student.validUntil);
  
  if (now > validUntil) {
    console.log('   ⚠️  Card expired');
    return res.json({
      success: false,
      error: 'Card has expired',
    });
  }
  
  console.log(`   ✅ Card verified: ${student.firstName} ${student.lastName}`);
  
  // Log access (in production, save to database)
  logAccess({
    studentId: student.id,
    cardId,
    timestamp: timestamp || new Date().toISOString(),
    location: 'Mobile App',
    success: true,
  });
  
  res.json({
    success: true,
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      department: student.department,
      role: student.role,
      validUntil: student.validUntil,
    },
  });
});

/**
 * POST /register-card
 * Register a new student card
 */
app.post('/register-card', (req, res) => {
  const { cardId, studentInfo } = req.body;
  
  if (!cardId || !studentInfo) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
    });
  }
  
  // Check if card already exists
  if (studentDatabase.has(cardId)) {
    return res.status(409).json({
      success: false,
      error: 'Card already registered',
    });
  }
  
  // Create student record
  const student = {
    id: generateStudentId(),
    cardNumber: cardId,
    ...studentInfo,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  
  // Save to database
  studentDatabase.set(cardId, student);
  
  console.log(`✅ New card registered: ${cardId}`);
  
  res.json({
    success: true,
    student,
  });
});

/**
 * GET /student/:cardId
 * Get student info by card ID
 */
app.get('/student/:cardId', (req, res) => {
  const { cardId } = req.params;
  
  const student = studentDatabase.get(cardId);
  
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student not found',
    });
  }
  
  res.json({
    success: true,
    student,
  });
});

/**
 * POST /check-access
 * Check if student has access to specific location
 */
app.post('/check-access', (req, res) => {
  const { cardId, location } = req.body;
  
  const student = studentDatabase.get(cardId);
  
  if (!student || !student.isActive) {
    return res.json({
      granted: false,
      reason: 'Invalid or inactive card',
    });
  }
  
  // Check location-specific permissions (simplified)
  const accessLevels = {
    'library': ['student', 'staff', 'admin'],
    'labs': ['student', 'staff', 'admin'],
    'admin-office': ['admin'],
    'faculty-lounge': ['staff', 'admin'],
  };
  
  const allowedRoles = accessLevels[location] || [];
  const granted = allowedRoles.includes(student.role);
  
  // Log access attempt
  logAccess({
    studentId: student.id,
    cardId,
    location,
    granted,
    timestamp: new Date().toISOString(),
  });
  
  res.json({
    granted,
    reason: granted ? 'Access granted' : 'Insufficient permissions',
    student: granted ? {
      name: `${student.firstName} ${student.lastName}`,
      role: student.role,
    } : null,
  });
});

// ====================== UTILITIES ======================

function generateStudentId() {
  return `STU${Date.now().toString().slice(-8)}`;
}

function logAccess(accessLog) {
  // In production, save to database
  console.log('📝 Access Log:', JSON.stringify(accessLog, null, 2));
}

// ====================== STARTUP ======================

// Initialize serial port
initializeSerialPort();

// Start server
app.listen(CONFIG.PORT, () => {
  console.log('');
  console.log('🚀 USB RFID Reader Service Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on http://localhost:${CONFIG.PORT}`);
  console.log(`🔌 Serial port: ${CONFIG.SERIAL_PORT}`);
  console.log(`⚡ Baud rate: ${CONFIG.BAUD_RATE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📚 Available endpoints:');
  console.log(`   GET  /health`);
  console.log(`   GET  /recent-scans`);
  console.log(`   POST /verify-student-card`);
  console.log(`   POST /register-card`);
  console.log(`   GET  /student/:cardId`);
  console.log(`   POST /check-access`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (serialPort && serialPort.isOpen) {
    serialPort.close((err) => {
      if (err) console.error('Error closing serial port:', err);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});