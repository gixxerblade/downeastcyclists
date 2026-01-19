/**
 * CSV parsing and validation utilities for bulk member import
 */

import type {BulkImportRow, ImportRowValidation} from '@/src/types/admin';

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string): Partial<BulkImportRow>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  // Map headers to normalized names first
  const headerMap: Record<string, keyof BulkImportRow> = {};
  const normalizedHeaders: (keyof BulkImportRow)[] = [];
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized) {
      headerMap[index.toString()] = normalized;
      normalizedHeaders.push(normalized);
    }
  });

  // Check for required headers using normalized names
  const requiredHeaders: (keyof BulkImportRow)[] = ['email', 'planType', 'startDate', 'endDate'];
  const missingHeaders = requiredHeaders.filter((h) => !normalizedHeaders.includes(h));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  // Parse data rows
  const rows: Partial<BulkImportRow>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Partial<BulkImportRow> = {};

    Object.entries(headerMap).forEach(([indexStr, field]) => {
      const index = parseInt(indexStr);
      const value = values[index]?.trim();
      if (value) {
        if (field === 'planType') {
          row[field] = value.toLowerCase() as 'individual' | 'family';
        } else {
          (row as Record<string, string>)[field] = value;
        }
      }
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Normalize header names to match BulkImportRow fields
 */
function normalizeHeader(header: string): keyof BulkImportRow | null {
  const normalized = header.toLowerCase().replace(/[_\s-]/g, '');

  const mapping: Record<string, keyof BulkImportRow> = {
    email: 'email',
    name: 'name',
    phone: 'phone',
    plantype: 'planType',
    plan: 'planType',
    type: 'planType',
    startdate: 'startDate',
    start: 'startDate',
    enddate: 'endDate',
    end: 'endDate',
    expiration: 'endDate',
    expires: 'endDate',
  };

  return mapping[normalized] || null;
}

/**
 * Validate a single import row
 */
export function validateRow(row: Partial<BulkImportRow>, index: number): ImportRowValidation {
  const errors: string[] = [];

  // Check required fields
  if (!row.email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      errors.push('Invalid email format');
    }
  }

  if (!row.planType) {
    errors.push('Plan type is required');
  } else if (!['individual', 'family'].includes(row.planType)) {
    errors.push('Plan type must be "individual" or "family"');
  }

  if (!row.startDate) {
    errors.push('Start date is required');
  } else {
    const startDate = parseDate(row.startDate);
    if (!startDate) {
      errors.push('Invalid start date format');
    }
  }

  if (!row.endDate) {
    errors.push('End date is required');
  } else {
    const endDate = parseDate(row.endDate);
    if (!endDate) {
      errors.push('Invalid end date format');
    }
  }

  // Validate date range
  if (row.startDate && row.endDate) {
    const startDate = parseDate(row.startDate);
    const endDate = parseDate(row.endDate);
    if (startDate && endDate && endDate <= startDate) {
      errors.push('End date must be after start date');
    }
  }

  // Build validated data if no errors
  let data: BulkImportRow | undefined;
  if (errors.length === 0 && row.email && row.planType && row.startDate && row.endDate) {
    const startDate = parseDate(row.startDate);
    const endDate = parseDate(row.endDate);

    if (startDate && endDate) {
      data = {
        email: row.email,
        name: row.name,
        phone: row.phone,
        planType: row.planType as 'individual' | 'family',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }
  }

  return {
    row: index + 1,
    valid: errors.length === 0,
    errors,
    data,
  };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date | null {
  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Check for slash-delimited dates
  const slashFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(slashFormat);
  if (match) {
    const [, first, second, year] = match;
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);
    const yearNum = parseInt(year);

    // If first number > 12, it must be DD/MM/YYYY
    if (firstNum > 12) {
      date = new Date(yearNum, secondNum - 1, firstNum);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try MM/DD/YYYY format
    date = new Date(yearNum, firstNum - 1, secondNum);
    if (!isNaN(date.getTime()) && date.getMonth() === firstNum - 1) {
      // Verify the month is correct (not wrapped around)
      return date;
    }

    // If MM/DD/YYYY failed or wrapped, try DD/MM/YYYY
    date = new Date(yearNum, secondNum - 1, firstNum);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Generate a CSV template for download
 */
export function generateCSVTemplate(): string {
  const headers = ['email', 'name', 'phone', 'planType', 'startDate', 'endDate'];
  const exampleRow = [
    'member@example.com',
    'John Doe',
    '207-555-1234',
    'individual',
    new Date().toISOString().split('T')[0],
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  ];

  return [headers.join(','), exampleRow.join(',')].join('\n');
}
