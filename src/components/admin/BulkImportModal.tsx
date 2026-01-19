'use client';

import {CloudUpload, Download} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Effect} from 'effect';
import {useState, useRef} from 'react';

import {parseCSV, validateRow, generateCSVTemplate} from '@/src/lib/csv-parser';
import {importMembers} from '@/src/lib/effect/client-admin';
import type {BulkImportResult, BulkImportRow, ImportRowValidation} from '@/src/types/admin';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function BulkImportModal({open, onClose}: BulkImportModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ImportRowValidation[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const importMutation = useMutation<BulkImportResult, Error, BulkImportRow[]>({
    mutationFn: (rows) => Effect.runPromise(importMembers(rows)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({queryKey: ['admin', 'members']});
      queryClient.invalidateQueries({queryKey: ['admin', 'stats']});
      if (result.errors.length === 0) {
        handleClose();
      }
    },
  });

  const handleClose = () => {
    setParsedRows([]);
    setParseError(null);
    importMutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const rows = parseCSV(content);

        if (rows.length === 0) {
          setParseError('No data rows found in CSV file');
          return;
        }

        const validatedRows = rows.map((row, index) => validateRow(row, index));
        setParsedRows(validatedRows);
        setParseError(null);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], {type: 'text/csv'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'member-import-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImport = () => {
    const validRows = parsedRows.filter((r) => r.valid && r.data).map((r) => r.data!);
    if (validRows.length === 0) {
      setParseError('No valid rows to import');
      return;
    }
    importMutation.mutate(validRows);
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Bulk Import Members</DialogTitle>
      <DialogContent>
        <Box sx={{pt: 2}}>
          <Alert severity="info" sx={{mb: 2}}>
            <Typography variant="body2">
              Upload a CSV file with member data. Required columns: email, planType, startDate,
              endDate. Optional columns: name, phone.
            </Typography>
          </Alert>

          {(parseError || importMutation.error) && (
            <Alert severity="error" sx={{mb: 2}}>
              {parseError || importMutation.error?.message}
            </Alert>
          )}

          {importMutation.data && (
            <Alert
              severity={importMutation.data.errors.length > 0 ? 'warning' : 'success'}
              sx={{mb: 2}}
            >
              Created {importMutation.data.created} members.
              {importMutation.data.errors.length > 0 && (
                <span> {importMutation.data.errors.length} errors occurred.</span>
              )}
            </Alert>
          )}

          <Box sx={{display: 'flex', gap: 2, mb: 3}}>
            <Button variant="outlined" startIcon={<Download />} onClick={handleDownloadTemplate}>
              Download Template
            </Button>

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{display: 'none'}}
            />
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload CSV
            </Button>
          </Box>

          {parsedRows.length > 0 && (
            <>
              <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                <Chip label={`Total: ${parsedRows.length}`} />
                <Chip label={`Valid: ${validCount}`} color="success" />
                {invalidCount > 0 && <Chip label={`Invalid: ${invalidCount}`} color="error" />}
              </Box>

              <TableContainer component={Paper} sx={{maxHeight: 400}}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Errors</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow
                        key={row.row}
                        sx={!row.valid ? {bgcolor: 'error.light'} : undefined}
                      >
                        <TableCell>{row.row}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.valid ? 'Valid' : 'Invalid'}
                            color={row.valid ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>{row.data?.email || '-'}</TableCell>
                        <TableCell>{row.data?.name || '-'}</TableCell>
                        <TableCell>{row.data?.planType || '-'}</TableCell>
                        <TableCell>{row.data?.startDate || '-'}</TableCell>
                        <TableCell>{row.data?.endDate || '-'}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <Typography variant="caption" color="error">
                              {row.errors.join(', ')}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={importMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={importMutation.isPending || validCount === 0}
          startIcon={importMutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {importMutation.isPending ? 'Importing...' : `Import ${validCount} Members`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
