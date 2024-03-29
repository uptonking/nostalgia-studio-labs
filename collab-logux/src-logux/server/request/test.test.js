import { spy } from 'nanospy';
import { expect, it } from 'vitest';

import { del, get, patch, post, put, request, ResponseError } from '../index';

it('has error', () => {
  let error = new ResponseError(
    403,
    '/a',
    { method: 'GET', body: 'body' },
    'answer',
  );
  expect(error.name).toEqual('ResponseError');
  expect(error.statusCode).toEqual(403);
  expect(error.message).toEqual(
    '403 response on GET /a {"body":"body"} answer',
  );
});

it('throws an error on non-2xx response', async () => {
  async function fetch() {
    return {
      status: 403,
      async text() {
        return 'answer';
      },
    };
  }
  await expect(
    request('/a', { method: 'GET', body: 'body' }, fetch),
  ).rejects.toThrow(
    new ResponseError(403, '/a', { method: 'GET', body: 'body' }, 'answer'),
  );
});

it('parses JSON body', async () => {
  async function fetch() {
    return {
      status: 200,
      async json() {
        return { answer: '1' };
      },
    };
  }
  expect(await request('/a', { method: 'GET' }, fetch)).toEqual({
    answer: '1',
  });
});

it('has shortcut for GET', async () => {
  let fetch = spy(async () => ({
    status: 200,
    async json() {
      return { answer: '1' };
    },
  }));

  expect(await get('/a', { headers: { a: 1 } }, fetch)).toEqual({
    answer: '1',
  });
  expect(fetch.calls).toEqual([
    [
      '/a',
      {
        method: 'GET',
        headers: { a: 1 },
      },
    ],
  ]);
});

it('has shortcut for POST', async () => {
  let fetch = spy(async () => ({ status: 204 }));
  await post('/a', { headers: { a: 1 } }, fetch);
  expect(fetch.calls).toEqual([
    [
      '/a',
      {
        method: 'POST',
        headers: { a: 1 },
      },
    ],
  ]);
});

it('has shortcut for PUT', async () => {
  let fetch = spy(async () => ({ status: 204 }));
  await put('/a', { headers: { a: 1 } }, fetch);
  expect(fetch.calls).toEqual([
    [
      '/a',
      {
        method: 'PUT',
        headers: { a: 1 },
      },
    ],
  ]);
});

it('has shortcut for PATCH', async () => {
  let fetch = spy(async () => ({ status: 204 }));
  await patch('/a', { headers: { a: 1 } }, fetch);
  expect(fetch.calls).toEqual([
    [
      '/a',
      {
        method: 'PATCH',
        headers: { a: 1 },
      },
    ],
  ]);
});

it('has shortcut for DELETE', async () => {
  let fetch = spy(async () => ({ status: 204 }));
  await del('/a', { headers: { a: 1 } }, fetch);
  expect(fetch.calls).toEqual([
    [
      '/a',
      {
        method: 'DELETE',
        headers: { a: 1 },
      },
    ],
  ]);
});

it('works without option object', async () => {
  async function fetch() {
    return {
      status: 404,
      async text() {
        return 'answer';
      },
    };
  }
  await expect(get('/a', undefined, fetch)).rejects.toThrow(
    new ResponseError(404, '/a', { method: 'GET' }, 'answer'),
  );
});
