import fs from 'fs';
import util from 'util';

// import { __dirname } from './utils';

/** generate an style object to make it easier to use in component
 * - input: 'font.family.size.f3': '16px',
 * - output: {font:{family:{size:{f3}}}}: 'var(--font-family-size-f3)',
 */
export const generateTokensVarsFromTokensProps = (tokens, outDir) => {
  const tokenVars = {};

  Object.keys(tokens).forEach((prop) => {
    const paths = prop.split('.');
    if (paths.length === 1) {
      tokenVars[prop] = `var(--${prop})`;
    } else {
      let currPath = tokenVars;
      let varValue = 'var(--nos-';

      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        if (!currPath[path]) currPath[path] = {};
        if (i === paths.length - 1) {
          currPath[path] = varValue + path + ')';
        } else {
          varValue += `${paths[i]}-`;
          currPath = currPath[path];
        }
      }
    }
  });

  fs.writeFileSync(
    outDir,
    `
/**
 * Design Tokens
 * Autogenerated from npm run build:design-tokens.
 * use with same-name.css.
 * DO NOT EDIT!
 */
export const themed = ${util.inspect(tokenVars, {
      showHidden: false,
      compact: false,
      depth: null,
    })} as const;`,
    { flag: 'w', encoding: 'utf-8' },
  );
};

// generateTokensVarsFromTokensProps(
//   resolve(__dirname, '../../example-client/styles/theme-vars.ts'),
// );