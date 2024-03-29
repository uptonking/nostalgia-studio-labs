export class Comment {
  from: number;
  to: number;
  text: string;
  id: number;
  constructor(from, to, text, id) {
    this.from = from;
    this.to = to;
    this.text = text;
    this.id = id;
  }

  static fromJSON(json) {
    return new Comment(json.from, json.to, json.text, json.id);
  }
}

type IEvent = { type: string; id?: number };

export class Comments {
  comments: Comment[];
  events: IEvent[];
  version: number;
  constructor(comments: Comment[] = []) {
    this.comments = comments || [];
    this.events = [];
    this.version = 0;
  }

  mapThrough(mapping) {
    for (let i = this.comments.length - 1; i >= 0; i--) {
      const comment = this.comments[i];
      const from = mapping.map(comment.from, 1);
      const to = mapping.map(comment.to, -1);
      if (from >= to) {
        this.comments.splice(i, 1);
      } else {
        comment.from = from;
        comment.to = to;
      }
    }
  }

  created(data) {
    this.comments.push(new Comment(data.from, data.to, data.text, data.id));
    this.events.push({ type: 'create', id: data.id });
    this.version++;
  }

  index(id) {
    for (let i = 0; i < this.comments.length; i++)
      if (this.comments[i].id == id) return i;
  }

  deleted(id) {
    const found = this.index(id);
    if (found != null) {
      this.comments.splice(found, 1);
      this.version++;
      this.events.push({ type: 'delete', id: id });
      return;
    }
  }

  eventsAfter(startIndex) {
    const result = [];
    for (let i = startIndex; i < this.events.length; i++) {
      const event = this.events[i];
      if (event.type == 'delete') {
        result.push(event);
      } else {
        const found = this.index(event.id);
        if (found != null) {
          const comment = this.comments[found];
          result.push({
            type: 'create',
            id: event.id,
            text: comment.text,
            from: comment.from,
            to: comment.to,
          });
        }
      }
    }
    return result;
  }
}
