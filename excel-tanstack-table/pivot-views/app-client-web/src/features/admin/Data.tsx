import React from 'react';

import _ from 'lodash';
import { useSearchParams } from 'react-router-dom';

import {
  type GridPatchProps,
  type PagedResult,
} from '@datalking/pivot-app-shared-lib';
import { DeleteForever } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  AppBar,
  Button,
  ButtonGroup,
  CircularProgress,
  debounce,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';

import { useAppDispatch } from '../../shared/store';
import { notify, request, useGet } from '../app';
import { Method } from '../app/thunks';
import AlertDialog, { type ShowDialogProps } from '../ui/AlertDialog';
import Spacer from '../ui/Spacer';
import { DataTable } from './DataTable';

const excluded = ['history'];

export interface PagingProps {
  page: number;
  limit: number;
}

export default function Data() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = React.useState('');
  const [selectedItems, setSelectedItems] = React.useState<(string | number)[]>(
    [],
  );
  const model = searchParams.get('model') || '';
  const [paging, setPaging] = React.useState<PagingProps>({
    limit: 100,
    page: 0,
  });
  const [alert, setAlert] = React.useState<ShowDialogProps>({
    open: false,
  });
  const { data, isLoading, error, refetch } = useGet<PagedResult>(
    model,
    `${model}`,
    {
      enabled: Boolean(model),
    },
    {
      ...paging,
      search: searchText,
    },
  );
  const refetchModel = React.useMemo(() => debounce(refetch, 500), [refetch]);
  const modelPlural = !model
    ? ''
    : _.capitalize(model) + (model?.endsWith('s') ? '' : 's');

  const onEdit = async (params: GridPatchProps) => {
    const response = await request(`${model}`, params, Method.PATCH);
    if (response) {
      dispatch(notify('Updated'));
    }
  };

  const handleSearch: React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  > = (e) => {
    setSearchText(e.target.value);
    refetchModel();
  };

  const handleDelete = () => {
    setAlert({
      open: true,
      message: `Are you sure you want to delete ${selectedItems.length} ${modelPlural}?`,
      title: 'Confirm',
      onConfirm: () => handleDeleteConfirm(),
      onCancel: () => setAlert({ open: false }),
    });
  };

  const handleDeleteConfirm = async () => {
    const response = await request<{ deleted: number }>(
      `${model}`,
      { ids: selectedItems },
      Method.DELETE,
    );
    if (response.data?.deleted > 0) {
      dispatch(notify('Deleted ' + response.data.deleted + ' item(s)'));
      setAlert({ open: false });
      refetchModel();
      return;
    }
    dispatch(notify('Failed to delete: ' + response.statusText));
  };

  const handlePaging = (newValues: Partial<PagingProps>) => {
    setPaging(newValues as PagingProps);
    refetchModel();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
      <>
        <Box sx={{ display: 'flex' }}>
          <Typography
            variant='h5'
            component='h1'
            align='center'
            gutterBottom
            marginLeft={1}
          >
            {modelPlural} ({data?.total || 0})
          </Typography>
          <Spacer />
          <ButtonGroup sx={{ mb: 1 }}>
            <Button onClick={handleDelete} disabled={!selectedItems.length}>
              Delete
              <DeleteForever />
            </Button>
          </ButtonGroup>
        </Box>
        {error && <Alert>{JSON.stringify(error)}</Alert>}
        <Box>
          <TextField
            placeholder='Search...'
            variant='filled'
            fullWidth
            value={searchText}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <DataTable
          loading={isLoading}
          data={data}
          paging={paging}
          onPaging={handlePaging}
          onEdit={onEdit}
          onSelectionChange={(selection: (string | number)[]) =>
            setSelectedItems(selection)
          }
        />
        {/* <AppBar position="fixed" color="primary" sx={{ top: 'auto', bottom: 0 }}>
        - enable editing?
        - export?
        - search on bottom?
        - too cool to not use
      </AppBar> */}
      </>
      <AlertDialog
        open={alert.open}
        message={alert.message}
        title={alert.title}
        onConfirm={alert.onConfirm}
        onCancel={alert.onCancel}
      />
    </Box>
  );
}
