import crelt from 'crelt';
import { type Command, type EditorState, Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

class Comment {
  id: number;
  text: string;
  constructor(text, id) {
    this.id = id;
    this.text = text;
  }
}

function deco(from: number, to: number, comment: Comment) {
  return Decoration.inline(from, to, { class: 'comment' }, { comment });
}

class CommentState {
  version: number;
  decos: any;
  unsent: any;
  constructor(version, decos, unsent) {
    this.version = version;
    this.decos = decos;
    this.unsent = unsent;
  }

  findComment(id) {
    const current = this.decos.find();
    for (let i = 0; i < current.length; i++)
      if (current[i].spec.comment.id == id) return current[i];
  }

  commentsAt(pos) {
    return this.decos.find(pos, pos);
  }

  apply(tr) {
    const action = tr.getMeta(commentPlugin);
    const actionType = action && action.type;
    if (!action && !tr.docChanged) return this;
    let base: CommentState = this;
    if (actionType === 'receive') {
      base = base.receive(action, tr.doc);
    }
    let decos = base.decos;
    let unsent = base.unsent;
    decos = decos.map(tr.mapping, tr.doc);
    if (actionType == 'newComment') {
      decos = decos.add(tr.doc, [deco(action.from, action.to, action.comment)]);
      unsent = unsent.concat(action);
    } else if (actionType == 'deleteComment') {
      decos = decos.remove([this.findComment(action.comment.id)]);
      unsent = unsent.concat(action);
    }
    return new CommentState(base.version, decos, unsent);
  }

  receive({ version, events, sent }, doc) {
    let set = this.decos;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'delete') {
        const found = this.findComment(event.id);
        if (found) set = set.remove([found]);
      } else {
        // "create"
        if (!this.findComment(event.id))
          set = set.add(doc, [
            deco(event.from, event.to, new Comment(event.text, event.id)),
          ]);
      }
    }
    return new CommentState(version, set, this.unsent.slice(sent));
  }

  unsentEvents() {
    const result = [];
    for (let i = 0; i < this.unsent.length; i++) {
      const action = this.unsent[i];
      if (action.type === 'newComment') {
        const found = this.findComment(action.comment.id);
        if (found)
          result.push({
            type: 'create',
            id: action.comment.id,
            from: found.from,
            to: found.to,
            text: action.comment.text,
          });
      } else {
        result.push({ type: 'delete', id: action.comment.id });
      }
    }
    return result;
  }

  static init(config) {
    const decos = config.comments.comments.map((c) =>
      deco(c.from, c.to, new Comment(c.text, c.id)),
    );
    return new CommentState(
      config.comments.version,
      DecorationSet.create(config.doc, decos),
      [],
    );
  }
}

/** 只处理comment state和decorations */
export const commentPlugin = new Plugin({
  state: {
    init: CommentState.init,
    apply(tr, prev) {
      return prev.apply(tr);
    },
  },
  props: {
    decorations(state) {
      return commentPlugin.getState(state).decos;
    },
  },
});

function randomID() {
  return Math.floor(Math.random() * 0xffffffff);
}

// Command for adding an annotation

export const addAnnotation = function (
  state: EditorState,
  dispatch?: Parameters<Command>[1],
) {
  const sel = state.selection;
  if (sel.empty) return false;
  if (dispatch) {
    const text = prompt('Annotation text', '');
    if (text)
      dispatch(
        state.tr.setMeta(commentPlugin, {
          type: 'newComment',
          from: sel.from,
          to: sel.to,
          comment: new Comment(text, randomID()),
        }),
      );
  }
  return true;
};

export const annotationIcon = {
  width: 1024,
  height: 1024,
  path: 'M512 219q-116 0-218 39t-161 107-59 145q0 64 40 122t115 100l49 28-15 54q-13 52-40 98 86-36 157-97l24-21 32 3q39 4 74 4 116 0 218-39t161-107 59-145-59-145-161-107-218-39zM1024 512q0 99-68 183t-186 133-257 48q-40 0-82-4-113 100-262 138-28 8-65 12h-2q-8 0-15-6t-9-15v-0q-1-2-0-6t1-5 2-5l3-5t4-4 4-5q4-4 17-19t19-21 17-22 18-29 15-33 14-43q-89-50-141-125t-51-160q0-99 68-183t186-133 257-48 257 48 186 133 68 183z',
};

// Comment UI

/** 基于decorations属性创建 */
export const createCommentUIPlugin = function (
  dispatch: Parameters<Command>[1],
) {
  return new Plugin({
    props: {
      decorations(state) {
        return commentTooltip(state, dispatch);
      },
    },
  });
};

function commentTooltip(state: EditorState, dispatch: Parameters<Command>[1]) {
  const sel = state.selection;
  if (!sel.empty) return null;
  const comments = commentPlugin.getState(state).commentsAt(sel.from);
  if (!comments.length) return null;
  console.log('widget', sel.from);
  return DecorationSet.create(state.doc, [
    Decoration.widget(sel.from, renderComments(comments, dispatch, state)),
  ]);
}

function renderComments(
  comments: { spec: { comment: Comment } }[],
  dispatch: Parameters<Command>[1],
  state: EditorState,
) {
  return crelt(
    'div',
    { class: 'tooltip-wrapper' },
    crelt(
      'ul',
      { class: 'commentList' },
      comments.map((c) => renderComment(c.spec.comment, dispatch, state)),
    ),
  );
}

function renderComment(
  comment: Comment,
  dispatch: Parameters<Command>[1],
  state: EditorState,
) {
  const btn = crelt(
    'button',
    { class: 'commentDelete', title: 'Delete annotation' },
    '×',
  );
  btn.addEventListener('click', () =>
    dispatch(
      state.tr.setMeta(commentPlugin, { type: 'deleteComment', comment }),
    ),
  );
  return crelt('li', { class: 'commentText' }, comment.text, btn);
}
