import { Path } from 'slate';

export const input = {
  path: [1],
  another: [0, 2],
};
export const test = ({ path, another }) => {
  return Path.endsAt(path, another);
};
export const output = false;
