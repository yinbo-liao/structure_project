import React, { useState } from 'react';
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
  Typography
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

export interface Column {
  field: string;
  headerName: string;
  width?: number;
  type?: 'text' | 'number' | 'select' | 'date' | 'boolean';
  options?: { value: any; label: string }[];
  editable?: boolean;
  sortable?: boolean;
  formatValue?: (value: any) => string;
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
  maxHeight = 600
}) => {
  const { canEdit, canDelete } = useAuth();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const handleEdit = (row: any) => {
    if (!canEdit()) return;
    setEditingId(row.id);
    setEditData({ ...row });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async (id: number) => {
    if (!onUpdate) return;
    
    try {
      await onUpdate(id, editData);
      setEditingId(null);
      setEditData({});
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

  const handleChange = (field: string, value: any) => {
    setEditData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const renderCell = (row: any, column: Column) => {
    const isEditing = editingId === row.id;
    const isEditable = column.editable !== false && canEdit();

    if (isEditing && isEditable) {
      if (column.type === 'select' && column.options) {
        return (
          <TextField
            select
            size="small"
            value={editData[column.field] || ''}
            onChange={(e) => handleChange(column.field, e.target.value)}
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
              editData[column.field] 
                ? new Date(editData[column.field]).toISOString().split('T')[0]
                : ''
            }
            onChange={(e) => handleChange(column.field, new Date(e.target.value).toISOString())}
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
            value={editData[column.field] ? 'true' : 'false'}
            onChange={(e) => handleChange(column.field, e.target.value === 'true')}
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
            value={editData[column.field] || ''}
            onChange={(e) => handleChange(column.field, column.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            fullWidth
            variant="outlined"
          />
        );
      }
    }

    // Display value
    let value = row[column.field];
    
    if (column.formatValue) {
      value = column.formatValue(value);
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
      <TableContainer component={Paper} sx={{ maxHeight }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell 
                  key={column.field} 
                  style={{ 
                    width: column.width,
                    fontWeight: 'bold',
                    backgroundColor: '#f5f5f5'
                  }}
                >
                  {column.headerName}
                </TableCell>
              ))}
              {showActions && (canEdit() || canDelete()) && (
                <TableCell style={{ width: 120, fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showActions ? 1 : 0)} align="center">
                  <Box p={2}>
                    Loading...
                  </Box>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showActions ? 1 : 0)} align="center">
                  <Box p={2}>
                    <Typography variant="body2" color="text.secondary">
                      No data available
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                <TableRow key={row.id} hover>
                  {columns.map((column) => (
                    <TableCell key={column.field}>
                      {editingId === row.id && (column.editable !== false) && canEdit()
                        ? renderCell(row, column)
                        : column.field.toLowerCase().includes('status')
                          ? renderStatusChip(row[column.field])
                          : renderCell(row, column)
                      }
                    </TableCell>
                  ))}
                  {showActions && (canEdit() || canDelete()) && (
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {canEdit() && (
                          <>
                            {editingId === row.id ? (
                              <>
                                <Tooltip title="Save">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleSave(row.id)}
                                  >
                                    <SaveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton
                                    size="small"
                                    color="secondary"
                                    onClick={handleCancel}
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
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </>
                        )}
                        {canDelete() && editingId !== row.id && (
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(row.id)}
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