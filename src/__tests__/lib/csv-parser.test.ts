import {describe, expect, it} from 'vitest';

import {parseCSV, validateRow, generateCSVTemplate} from '@/src/lib/csv-parser';

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('should parse valid CSV with all fields', () => {
      const csv = `email,name,phone,planType,startDate,endDate
john@example.com,John Doe,207-555-1234,individual,2026-01-01,2026-12-31
jane@example.com,Jane Smith,207-555-5678,family,2026-02-01,2027-01-31`;

      const rows = parseCSV(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        email: 'john@example.com',
        name: 'John Doe',
        phone: '207-555-1234',
        planType: 'individual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(rows[1]).toEqual({
        email: 'jane@example.com',
        name: 'Jane Smith',
        phone: '207-555-5678',
        planType: 'family',
        startDate: '2026-02-01',
        endDate: '2027-01-31',
      });
    });

    it('should handle quoted values with commas', () => {
      const csv = `email,name,planType,startDate,endDate
"john@example.com","Doe, John",individual,2026-01-01,2026-12-31`;

      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Doe, John');
    });

    it('should handle missing optional fields', () => {
      const csv = `email,planType,startDate,endDate
john@example.com,individual,2026-01-01,2026-12-31`;

      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        email: 'john@example.com',
        planType: 'individual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(rows[0].name).toBeUndefined();
    });

    it('should normalize header names', () => {
      const csv = `Email,Plan Type,Start Date,End Date
john@example.com,individual,2026-01-01,2026-12-31`;

      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        email: 'john@example.com',
        planType: 'individual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
    });

    it('should handle alternative header names', () => {
      const csv = `email,planType,startDate,endDate
john@example.com,individual,2026-01-01,2026-12-31`;

      const rows = parseCSV(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('john@example.com');
      expect(rows[0].planType).toBe('individual');
      expect(rows[0].startDate).toBe('2026-01-01');
      expect(rows[0].endDate).toBe('2026-12-31');
    });

    it('should skip empty lines', () => {
      const csv = `email,planType,startDate,endDate
john@example.com,individual,2026-01-01,2026-12-31

jane@example.com,family,2026-02-01,2027-01-31`;

      const rows = parseCSV(csv);

      expect(rows).toHaveLength(2);
    });

    it('should throw error if missing required columns', () => {
      const csv = `email,name
john@example.com,John Doe`;

      expect(() => parseCSV(csv)).toThrow('Missing required columns');
    });

    it('should throw error if no data rows', () => {
      const csv = `email,planType,startDate,endDate`;

      expect(() => parseCSV(csv)).toThrow('at least one data row');
    });
  });

  describe('validateRow', () => {
    it('should validate a correct row', () => {
      const row = {
        email: 'john@example.com',
        name: 'John Doe',
        phone: '207-555-1234',
        planType: 'individual' as const,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
      expect(result.data?.email).toBe('john@example.com');
    });

    it('should fail validation for missing email', () => {
      const row = {
        planType: 'individual' as const,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email is required');
      expect(result.data).toBeUndefined();
    });

    it('should fail validation for invalid email format', () => {
      const row = {
        email: 'invalid-email',
        planType: 'individual' as const,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should fail validation for invalid plan type', () => {
      const row = {
        email: 'john@example.com',
        planType: 'premium' as any,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan type must be "individual" or "family"');
    });

    it('should fail validation for end date before start date', () => {
      const row = {
        email: 'john@example.com',
        planType: 'individual' as const,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });

    it('should fail validation for invalid date format', () => {
      const row = {
        email: 'john@example.com',
        planType: 'individual' as const,
        startDate: 'not-a-date',
        endDate: '2026-12-31',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid start date format');
    });

    it('should accept MM/DD/YYYY date format', () => {
      const row = {
        email: 'john@example.com',
        planType: 'individual' as const,
        startDate: '01/01/2026',
        endDate: '12/31/2026',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(true);
      expect(result.data?.startDate).toBe('2026-01-01');
      expect(result.data?.endDate).toBe('2026-12-31');
    });

    it('should accept DD/MM/YYYY date format', () => {
      const row = {
        email: 'john@example.com',
        planType: 'individual' as const,
        startDate: '15/01/2026', // Day > 12, so interpreted as DD/MM/YYYY
        endDate: '15/01/2027',
      };

      const result = validateRow(row, 0);

      expect(result.valid).toBe(true);
      expect(result.data?.startDate).toBe('2026-01-15');
      expect(result.data?.endDate).toBe('2027-01-15');
    });

    it('should include row number in result', () => {
      const row = {
        email: 'john@example.com',
        planType: 'individual' as const,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = validateRow(row, 5);

      expect(result.row).toBe(6); // 1-indexed
    });
  });

  describe('generateCSVTemplate', () => {
    it('should generate a valid CSV template', () => {
      const template = generateCSVTemplate();

      const lines = template.split('\n');
      expect(lines).toHaveLength(2);

      const headers = lines[0].split(',');
      expect(headers).toEqual(['email', 'name', 'phone', 'planType', 'startDate', 'endDate']);

      const exampleRow = lines[1].split(',');
      expect(exampleRow[0]).toBe('member@example.com');
      expect(exampleRow[1]).toBe('John Doe');
      expect(exampleRow[2]).toBe('207-555-1234');
      expect(exampleRow[3]).toBe('individual');
      expect(exampleRow[4]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO date format
      expect(exampleRow[5]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
