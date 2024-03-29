import React from 'react';

import _ from 'lodash';

import {
  type PagedResult,
  type Subscription,
  type SubscriptionPlan,
} from '@datalking/pivot-app-shared-lib';
import { Delete, Edit, Search as SearchIcon } from '@mui/icons-material';
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Accordion,
  AccordionActions,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  ButtonGroup,
  debounce,
  Dialog,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridEventListener,
} from '@mui/x-data-grid';

import { useGet } from '../../app';
import AlertDialog, { type ShowDialogProps } from '../../ui/AlertDialog';
import { type PagingProps } from '../Data';
import PlanEdit from './PlanEdit';
import SubscriptionEdit from './Subscription';

export default function Subscriptions() {
  const [tab, setTab] = React.useState('all');
  const [searchText, setSearchText] = React.useState('');
  const [selectedItems, setSelectedItems] = React.useState<(string | number)[]>(
    [],
  );
  const [paging, setPaging] = React.useState<PagingProps>({
    limit: 100,
    page: 0,
  });
  const [alert, setAlert] = React.useState<ShowDialogProps>({
    open: false,
  });
  const [showPlan, setShowPlan] = React.useState<ShowDialogProps>({
    open: false,
  });
  const [showSubscription, setShowSubscription] =
    React.useState<ShowDialogProps>({
      open: false,
    });
  const { data, isLoading, error, refetch } = useGet<PagedResult<Subscription>>(
    'subscriptions',
    `subscription`,
    {},
    {
      ...paging,
      search: searchText,
    },
  );

  const { data: plans } = useGet<PagedResult<SubscriptionPlan>>(
    'plans',
    `subscriptionplan`,
  );
  const refetchSubscription = React.useMemo(
    () => debounce(refetch, 500),
    [refetch],
  );

  const filters = ['all', 'active', 'expired', 'cancelled'];

  const columns: GridColDef[] = [
    {
      field: 'user.email',
      headerName: 'name',
      editable: true,
    },
    {
      field: 'description',
      headerName: 'Description',
      editable: true,
    },
    {
      field: 'amount',
      headerName: 'Price',
    },
    {
      field: 'interval',
      headerName: 'Interval',
    },
    {
      field: 'intervalCount',
      headerName: 'Count',
    },
    {
      field: 'enabled',
      headerName: 'enabled',
    },
  ];

  const handleChangePage = (newPage: number, details: unknown): void => {
    console.log('handleChangePage', newPage);
  };

  const handleChangeRowsPerPage = (pageSize: number) => {
    console.log('handleChangeRowsPerPage', pageSize);
  };

  const handleEdit: GridEventListener<'cellEditCommit'> = (params, event) => {
    const value = (event as { target: { value: unknown } }).target.value;
    const { id, field } = params;
    console.log('handleEdit', id, field, value);
  };

  const handleSearch: React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  > = (e) => {
    setSearchText(e.target.value);
    refetchSubscription();
  };

  const handleViewDetails = () => {
    const first = data?.items.find((i) => i.userId === selectedItems[0]);
    setShowPlan({
      open: true,
      title: 'User Details',
      payload: first,
    });
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <>
        <Accordion>
          <AccordionSummary>
            <Typography>Plans</Typography>
            <Button onClick={() => setShowPlan({ open: true })}>Add</Button>
          </AccordionSummary>
          <AccordionDetails>
            {plans?.items?.map((p) => (
              <Box key={p.subscriptionPlanId} sx={{ margin: '.5rem' }}>
                <Typography>{p.name}</Typography>
                <Typography>{p.description}</Typography>
                <Typography>{p.amount}</Typography>
                <Typography>{p.interval}</Typography>
                <IconButton>
                  <Edit />
                </IconButton>
                <IconButton>
                  <Delete />
                </IconButton>
              </Box>
            ))}
          </AccordionDetails>
          <AccordionActions></AccordionActions>
        </Accordion>

        <Typography>Subscriptions</Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            margin: '.2rem 0',
          }}
        >
          <ToggleButtonGroup
            exclusive
            color='primary'
            value={tab}
            onChange={(e, v) => setTab(v)}
            defaultChecked={true}
          >
            {filters.map((f) => (
              <ToggleButton key={f} value={f} aria-label={f}>
                {f}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ButtonGroup size='small'>
            <Button color='warning'>Cancel</Button>
          </ButtonGroup>
        </Box>
        {error && <Alert>{JSON.stringify(error)}</Alert>}
        <Box>
          <TextField
            size='small'
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
        <DataGrid
          sx={{ height: '60vh' }}
          rows={data?.items || []}
          columns={columns}
          pageSize={paging.limit}
          page={paging.page}
          rowsPerPageOptions={[5]}
          checkboxSelection
          loading={isLoading}
          experimentalFeatures={{ newEditingApi: true }}
          getRowId={(row) => row[Object.keys(row)[0]]}
          onCellEditStop={handleEdit}
          onSelectionModelChange={(newSelectionModel) => {
            setSelectedItems(newSelectionModel || []);
          }}
        />
        <AlertDialog
          open={alert.open}
          message={alert.message}
          title={alert.title}
          onConfirm={alert.onConfirm}
          onCancel={alert.onCancel}
        />

        <Dialog
          open={showPlan.open}
          onClose={() => setShowPlan({ open: false })}
          aria-labelledby='alert-dialog-title'
          aria-describedby='alert-dialog-description'
          sx={{
            '& .MuiDialog-paper': {
              width: '100%',
              maxWidth: '100%',
              minHeight: '70%',
              borderRadius: '16px',
            },
          }}
        >
          <PlanEdit
            item={showPlan.payload as SubscriptionPlan}
            setState={(sub: SubscriptionPlan) =>
              setShowPlan((prev) => ({ ...prev, payload: sub }))
            }
          />
        </Dialog>
      </>
    </Box>
  );
}
