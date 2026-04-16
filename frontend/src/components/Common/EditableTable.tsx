import React, { useCallback, useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  TextField,
  MenuItem,
  Box,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Checkbox
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

export interface Column {
  field: string;
  headerName: string;
  width?: number;
  type?: 'text' | 'number' | 'select' | 'date' | 'boolean';
  options?: { value: any; label: string }[];
  editable?: boolean;
  sortable?: boolean;
  formatValue?: (value: any) => string;
  renderCell?: (row: any, isEditing: boolean, handleChange: (field: string, value: any) => void) => React.ReactNode;
}

interface EditableTableProps {
  data: any[];
  columns: Column[];
  onUpdate?: (id: number, data: any) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onCreate?: (data: any) => Promise<void>;
  title?: string;
  loading?: boolean;
  selectable?: boolean;
  showActions?: boolean;
  maxHeight?: number;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
}

const EditableTable: React.FC<EditableTableProps> = ({
  data,
  columns,
  onUpdate,
  onDelete,
  onCreate,
  title,
  loading = false,
  selectable = true,
  showActions = true,
  maxHeight = 600,
  selectedIds: controlledSelectedIds,
  onSelectionChange
}) => {
  const { canEdit, canDelete } = useAuth();
  const [editingIds, setEditingIds] = useState<number[]>([]);
  const [editData, setEditData] = useState<Record<number, any>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(50);
  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>([]);
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const isControlledSelection = controlledSelectedIds !== undefined;

  const updateSelectedIds = useCallback((next: number[] | ((prev: number[]) => number[])) => {
    const resolvedNext = typeof next === 'function' ? next(selectedIds) : next;
    if (isControlledSelection) {
      onSelectionChange?.(resolvedNext);
    } else {
      setInternalSelectedIds(resolvedNext);
      onSelectionChange?.(resolvedNext);
    }
  }, [isControlledSelection, onSelectionChange, selectedIds]);

  useEffect(() => {
    const validIds = new Set(data.map(row => row.id));
    const filteredSelectedIds = selectedIds.filter(id => validIds.has(id));
    if (filteredSelectedIds.length !== selectedIds.length) {
      updateSelectedIds(filteredSelectedIds);
    }
  }, [data, selectedIds, updateSelectedIds]);

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const allSelected = selectable && paginatedData.length > 0 && paginatedData.every(row => selectedIds.includes(row.id));
  const someSelected = selectable && paginatedData.some(row => selectedIds.includes(row.id));

  const handleSelectAll = (checked: boolean) => {
    if (!selectable) return;
    if (checked) {
      const pageIds = paginatedData.map(row => row.id);
      const next = Array.from(new Set([...selectedIds, ...pageIds]));
      updateSelectedIds(next);
    } else {
      const pageIds = new Set(paginatedData.map(row => row.id));
      updateSelectedIds(selectedIds.filter(id => !pageIds.has(id)));
    }
  };

  const handleSelectOne = (id: number) => {
    if (!selectable) return;
    updateSelectedIds(prev =>
      prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]
    );
  };

  const handleEdit = (row: any) => {
    if (!canEdit()) return;
    const targetIds =
      selectable && selectedIds.includes(row.id) && selectedIds.length > 0
        ? selectedIds
        : [row.id];
    setEditingIds(targetIds);
    setEditData(prev => {
      const next: Record<number, any> = { ...prev };
      targetIds.forEach(id => {
        const r = data.find(x => x.id === id);
        if (r) {
          next[id] = { ...r };
        }
      });
      return next;
    });
  };

  const handleCancel = (id: number) => {
    setEditingIds(prev => prev.filter(value => value !== id));
    setEditData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSave = async (id: number) => {
    if (!onUpdate) return;
    const rowData = editData[id];
    if (!rowData) return;
    
    try {
      await onUpdate(id, rowData);
      setEditingIds(prev => prev.filter(value => value !== id));
      setEditData(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMessage({ text: 'Record updated successfully', type: 'success' });
    } catch (error: any) {
      setMessage({ 
        text: error.response?.data?.detail || 'Error updating record', 
        type: 'error' 
      });
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete || !deleteId) return;
    
    try {
      await onDelete(deleteId);
      setDeleteId(null);
      setDeleteConfirmOpen(false);
      setMessage({ text: 'Record deleted successfully', type: 'success' });
    } catch (error: any) {
      setMessage({ 
        text: error.response?.data?.detail || 'Error deleting record', 
        type: 'error' 
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteId(null);
    setDeleteConfirmOpen(false);
  };

  const handleChange = (id: number, field: string, value: any) => {
    setEditData(prev => {
      const current = prev[id] || {};
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const renderCell = (row: any, column: Column) => {
    const isEditing = editingIds.includes(row.id);
    const isEditable = column.editable !== false && canEdit();
    const rowEditData = editData[row.id] || {};

    // Use custom renderer if provided
    if (column.renderCell) {
      // Merge original row with current edit data so the renderer sees updates
      const effectiveRow = isEditing ? { ...row, ...rowEditData } : row;
      
      return column.renderCell(
        effectiveRow,
        isEditing && isEditable,
        (field: string, value: any) => handleChange(row.id, field, value)
      );
    }

    if (isEditing && isEditable) {
      if (column.type === 'select' && column.options) {
        return (
          <TextField
            select
            size="small"
            value={rowEditData[column.field] || ''}
            onChange={(e) => handleChange(row.id, column.field, e.target.value)}
            fullWidth
            variant="outlined"
          >
            {column.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        );
      } else if (column.type === 'date') {
        return (
          <TextField
            type="date"
            size="small"
            value={
              rowEditData[column.field] 
                ? new Date(rowEditData[column.field]).toISOString().split('T')[0]
                : ''
            }
            onChange={(e) => handleChange(row.id, column.field, new Date(e.target.value).toISOString())}
            fullWidth
            variant="outlined"
            InputLabelProps={{ shrink: true }}
          />
        );
      } else if (column.type === 'boolean') {
        return (
          <TextField
            select
            size="small"
            value={rowEditData[column.field] ? 'true' : 'false'}
            onChange={(e) => handleChange(row.id, column.field, e.target.value === 'true')}
            fullWidth
            variant="outlined"
          >
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </TextField>
        );
      } else {
        return (
          <TextField
            type={column.type === 'number' ? 'number' : 'text'}
            size="small"
            value={rowEditData[column.field] || ''}
            onChange={(e) => handleChange(row.id, column.field, column.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            fullWidth
            variant="outlined"
          />
        );
      }
    }

    // Display value
    let value = row[column.field];
    
    if (column.formatValue) {
      value = column.formatValue(row);
    } else if (column.type === 'date' && value) {
      value = new Date(value).toLocaleDateString();
    } else if (column.type === 'boolean') {
      value = value ? 'Yes' : 'No';
    } else if (value === null || value === undefined) {
      value = '-';
    }
    
    return value;
  };

  const renderStatusChip = (value: string) => {
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
    
    switch (value?.toLowerCase()) {
      case 'accepted':
      case 'approved':
      case 'done':
        color = 'success';
        break;
      case 'rejected':
      case 'pending':
        color = 'warning';
        break;
      case 'inspected':
        color = 'info';
        break;
      default:
        color = 'default';
    }
    
    return (
      <Chip 
        size="small" 
        label={value || '-'} 
        color={color} 
        variant="outlined"
      />
    );
  };

  return (
    <>
      <TableContainer 
        component={Paper} 
        sx={{ 
          maxHeight,
          width: '100%',
          overflowX: 'auto',
          boxShadow: 2,
          borderRadius: 1
        }}
      >
        <Table stickyHeader size="medium">
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell
                  padding="checkbox"
                  sx={{
                    width: 60,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 8px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main'
                  }}
                >
                  <Checkbox
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={event => handleSelectAll(event.target.checked)}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell 
                  key={column.field} 
                  sx={{ 
                    width: column.width || 'auto',
                    minWidth: column.width ? undefined : 120,
                    fontWeight: 600,
                    backgroundColor: 'grey.100',
                    fontSize: '0.875rem',
                    padding: '16px 16px',
                    borderBottom: '2px solid',
                    borderBottomColor: 'primary.main',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {column.headerName}
                </TableCell>
              ))}
              {showActions && (canEdit() || canDelete()) && (
                <TableCell sx={{ 
                  width: 140, 
                  fontWeight: 600,
                  backgroundColor: 'grey.100',
                  fontSize: '0.875rem',
                  padding: '16px 16px',
                  borderBottom: '2px solid',
                  borderBottomColor: 'primary.main'
                }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showActions ? 1 : 0) + (selectable ? 1 : 0)} align="center">
                  <Box p={3}>
                    <Typography variant="body2" color="text.secondary">
                      Loading data...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showActions ? 1 : 0) + (selectable ? 1 : 0)} align="center">
                  <Box p={3}>
                    <Typography variant="body2" color="text.secondary">
                      No data available
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => (
                <TableRow 
                  key={row.id} 
                  hover 
                  selected={selectable && selectedIds.includes(row.id)}
                  sx={{ 
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'primary.light',
                      '&:hover': {
                        backgroundColor: 'primary.light'
                      }
                    }
                  }}
                >
                  {selectable && (
                    <TableCell padding="checkbox" sx={{ padding: '12px 8px' }}>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onChange={() => handleSelectOne(row.id)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell 
                      key={column.field}
                      sx={{ 
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        borderBottom: '1px solid',
                        borderBottomColor: 'grey.200'
                      }}
                    >
                      {editingIds.includes(row.id) && (column.editable !== false) && canEdit()
                        ? renderCell(row, column)
                        : column.field.toLowerCase().includes('status')
                          ? renderStatusChip(row[column.field])
                          : renderCell(row, column)
                      }
                    </TableCell>
                  ))}
                  {showActions && (canEdit() || canDelete()) && (
                    <TableCell sx={{ 
                      padding: '12px 16px',
                      borderBottom: '1px solid',
                      borderBottomColor: 'grey.200'
                    }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {canEdit() && (
                          <>
                            {editingIds.includes(row.id) ? (
                              <>
                                <Tooltip title="Save">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleSave(row.id)}
                                    sx={{ 
                                      backgroundColor: 'primary.main',
                                      color: 'white',
                                      '&:hover': {
                                        backgroundColor: 'primary.dark'
                                      }
                                    }}
                                  >
                                    <SaveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton
                                    size="small"
                                    color="secondary"
                                    onClick={() => handleCancel(row.id)}
                                    sx={{ 
                                      backgroundColor: 'grey.300',
                                      '&:hover': {
                                        backgroundColor: 'grey.400'
                                      }
                                    }}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ) : (
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEdit(row)}
                                  sx={{ 
                                    border: '1px solid',
                                    borderColor: 'primary.main',
                                    color: 'primary.main',
                                    '&:hover': {
                                      backgroundColor: 'primary.light'
                                    }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </>
                        )}
                        {canDelete() && !editingIds.includes(row.id) && (
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(row.id)}
                              sx={{ 
                                border: '1px solid',
                                borderColor: 'error.main',
                                color: 'error.main',
                                '&:hover': {
                                  backgroundColor: 'error.light'
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={data.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={() => {}}
        rowsPerPageOptions={[50]}
      />

      {/* Success/Error Messages */}
      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setMessage(null)} 
          severity={message?.type || 'info'}
          sx={{ width: '100%' }}
        >
          {message?.text}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this record? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained" 
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EditableTable;
