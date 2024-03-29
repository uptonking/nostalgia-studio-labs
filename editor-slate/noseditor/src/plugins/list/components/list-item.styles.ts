import { css } from '@linaria/core';

export const listItemDefaultCss = css`
  :global() {
    .list-item {
      position: relative;
      display: flex;
      align-items: start;
      list-style: none;

      &.folded .folding-pointer,
      & .folding-pointer:hover {
        transition: 300ms transform;
        transform: rotate(-90deg);
      }

      .pointer {
        color: var(--nos-palette-black, #212529);
      }

      .checkbox-pointer {
        float: left;
        margin-top: 3px;
        user-select: none;
        cursor: pointer;
        pointer-events: auto;
      }

      &:not(.folded) .folding-pointer:hover {
        transform: rotate(0deg);
      }
    }

    .list-item-numbered .pointer {
      // margin-right: 3px;
      padding-left: 1px;
    }

    .list-item-bulleted .pointer {
      margin-right: 3px;
      padding-left: 1px;
    }

    .list-item-todoList .pointer {
      margin-right: 3px;
    }

    .list-line {
      user-select: none;
      position: absolute;
      width: 20px;
      height: var(--height);
      top: 26px;
      z-index: 1000;
      cursor: pointer;
      visibility: hidden;
      /*left: calc(39px + var(--spacing));*/
    }

    .list-line::before {
      width: 2px;
      height: 100%;
      background-color: lightgrey;
      display: block;
      /* uncomment to show vertical indicator-line */
      /* content: ''; */
      margin-left: 10px;
      transition:
        200ms box-shadow,
        200ms background-color;
    }

    .list-line:hover::before {
      background-color: #0177ff;
      box-shadow: 0 0 1px #0177ff;
    }
  }
`;
