import diff_match_patch from 'diff-match-patch';
import { io, type Socket } from 'socket.io-client';

import {
  type InsertTimingStats,
  log,
  WCharId,
  WOperationType,
  WString,
  WStringOperation,
} from './woot';

/**
 * A Controller instance is tied to a textarea on the page. To make your
 * <textarea id="collab-doc" /> collaborative, just instantiate a controller
 * for it, like so:
 *
 * controller = new Controller("#collab-doc");
 *
 * This is how it works:
 *
 * 1. First it tries to get a siteId from the server. Once it gets one, it
 *    shows the textarea and starts polling it for changes.
 * 2. When a change is detected, diff the textarea content against the last
 *    known content. With the help of WootTypes.WString, turn that diff into
 *    WStringOperations and broadcast those operations to the server.
 * 3. When we receive operations from the server, apply those operations to
 *    our WString instance and apply them to the text in #collab-doc.
 */
export class DocumentController {
  _socket: Socket;
  /** _siteId is -1 before we hear back from the server */
  _siteId: number;
  /** Counts the operations made by this siteNumber */
  _operationCounter: number;
  /**  div of the textarea that we're watching */
  _textArea: HTMLTextAreaElement;
  _lastKnownDocumentContent: string;
  /** collaborative string */
  _string: WString | null;

  /** This is where we keep remote operations until they're ready to be executed */
  _pendingRemoteOperations: Array<WStringOperation>;

  _lastSyncTimeoutId: number;

  constructor(elementSelector: HTMLTextAreaElement, socket: Socket) {
    log('DocumentController created');
    this._socket = socket;
    this._siteId = -1;
    this._operationCounter = 0;
    this._textArea = elementSelector;
    this._lastKnownDocumentContent = '';
    this._string = null;
    this._pendingRemoteOperations = [];

    this._textArea.style.display = 'none'; // Re-shown in handleReceiveSiteId
    this._socket.on('site_id', this.handleReceiveSiteId.bind(this));
    this._socket.on('text_operations', this.handleRemoteOperations.bind(this));
  }

  /** id generator with auto-incremental _operationCounter */
  nextCharId(): WCharId {
    this._operationCounter += 1;
    return new WCharId(this._siteId, this._operationCounter);
  }

  /** add change event listener to textarea */
  handleReceiveSiteId(siteId: number) {
    log('DocumentController received siteId: ', siteId);
    this._siteId = siteId;
    this._textArea.style.display = '';
    this._textArea.setAttribute('contenteditable', 'true');

    // TODO(ryan): This is a hack. Sometimes a textarea's val starts out as a newline. Fix this.
    this._textArea.value = '';
    this._lastKnownDocumentContent = this._textArea.value;
    this._string = new WString(this.nextCharId.bind(this));
    // this._textArea.bind(
    //   'input propertychange',
    //   this.handleTextAreaChangeEvent.bind(this),
    // );

    this._textArea.addEventListener(
      'input',
      this.handleTextAreaChangeEvent.bind(this),
    );
  }

  /**
   * The logic for syncing changes is to wait 500ms from the last change and then
   * to sync. This is weird in the case that someone is typing out a whole paragraph
   * and it seems like it's not syncing at all.
   *
   * On the other hand, syncing on every text event can feel pretty laggy. I bet the
   * right thing to do is a middle ground where we do what we're doing now, but we
   * flush when we see the text diff get big enough...
   */
  handleTextAreaChangeEvent() {
    // Clear the last handler for a text change event in case it hasn't happened
    window.clearTimeout(this._lastSyncTimeoutId);

    this._lastSyncTimeoutId = window.setTimeout(() => {
      log('Passed inactivity threshold. Syncing document.');
      const newText = this._textArea.value;
      if (newText === this._lastKnownDocumentContent) {
        log('Returning early; nothing to sync!');
        return;
      }
      this.processLocalTextDiff(this._lastKnownDocumentContent, newText);
      this._lastKnownDocumentContent = newText;
    }, 250);
  }

  /**
   * This should be called when we notice a change in our text view. It compares the old text
   * against the new, generates the appropriate WStringOperations, and sends them to the server
   * for broadcasting.
   * - 💡 执行diff，将diff结果转换成WOOT对应的insert/delete
   */
  processLocalTextDiff(oldText: string, newText: string) {
    const startTimeMs = performance.now();
    log(
      'Processing text diff of length',
      Math.abs(oldText.length - newText.length),
    );
    const differ = new diff_match_patch();

    // Each `any` is a two-element list of text-operation-type and the text that
    // it applies to, like ["DIFF_DELETE", "monkey"] or ["DIFF_EQUAL", "cat"] or
    // ["DIFF_INSERT", "rabbit"]
    const results: Array<Array<any>> = differ.diff_main(oldText, newText);

    const stats: InsertTimingStats = {
      numInsertOpsGenerated: 0,
      timeSpentEach: [],
      whileLoopIterationsEach: [],
      totalGroupLoopIterationsEach: [],
      totalWalkLoopIterationsEach: [],
    };

    // Turn the results into a set of operations that our woot algorithm understands
    let cursorLocation = 0;
    const operationBuffer: Array<any> = [];
    for (let i = 0; i < results.length; i++) {
      const op = results[i][0];
      const text = results[i][1];

      if (op === diff_match_patch.DIFF_DELETE) {
        for (let j = 0; j < text.length; j++) {
          log('Delete char ' + text[j] + ' at index ' + cursorLocation);
          const operation = this._string?.generateDeleteOperation(
            text[j],
            cursorLocation,
          );
          if (operation) operationBuffer.push(operation.toJSON());
          // cursorLocation doesn't change. We moved forward one character in the string
          // but deleted that character, so our 'index' into the string hasn't changed.
        }
      } else if (op === diff_match_patch.DIFF_INSERT) {
        for (let j = 0; j < text.length; j++) {
          log(
            'Insert char ' + text[j] + ' after char at index ' + cursorLocation,
          );
          const operation = this._string?.generateInsertOperation(
            text[j],
            cursorLocation,
            stats,
          );
          if (operation) operationBuffer.push(operation.toJSON());
          cursorLocation += 1;
        }
      } else if (op === diff_match_patch.DIFF_EQUAL) {
        cursorLocation += text.length;
      }
    }

    log(stats);
    log(
      '[Timing] Non-socket work of processLocalTextDiff took ' +
        (performance.now() - startTimeMs) +
        ' milliseconds.',
    );
    this.sendMessage('text_operations', operationBuffer);
  }

  handleRemoteOperations(jsonOperations: Array<any>) {
    const stats: InsertTimingStats = {
      numInsertOpsGenerated: 0,
      timeSpentEach: [],
      whileLoopIterationsEach: [],
      totalGroupLoopIterationsEach: [],
      totalWalkLoopIterationsEach: [],
    };

    for (let i = 0; i < jsonOperations.length; i++) {
      const operation = WStringOperation.fromJSON(jsonOperations[i]);
      this._pendingRemoteOperations.push(operation);
    }

    const newPendingOperations: Array<any> = [];
    for (let i = 0; i < this._pendingRemoteOperations.length; i++) {
      const operation = this._pendingRemoteOperations[i];

      if (!this._string?.isExecutable(operation)) {
        newPendingOperations.push(operation);
        continue;
      }

      log('[handleRemoteOperation] Entered with operation', operation);
      log(this._string);
      if (
        operation.opType() === WOperationType.insert &&
        this._string.contains(operation.char().id())
      ) {
        log(
          '[handleRemoteOperation] returning early because we already have this op',
        );
        continue;
      }

      switch (operation.opType()) {
        case WOperationType.insert:
          log('[handleRemoteOperation] integrating insert');
          this._string.integrateInsertion(operation.char(), stats);
          break;

        case WOperationType.delete:
          log('[handleRemoteOperation] integrating delete');
          this._string.integrateDeletion(operation.char());
          break;
      }
    }

    // Set this so that we don't think the user made this change and enter
    // a feedback loop
    this._lastKnownDocumentContent = this._string!.stringForDisplay();
    this._textArea.value = this._string!.stringForDisplay();

    // TODO(ryan): This should be a dag, not a list...
    this._pendingRemoteOperations = newPendingOperations;
  }

  /** Sends a message to the server. Returns false if sending failed
   * e.g. if we haven't received our siteId yet.
   * */
  sendMessage(message: string, data: any): boolean {
    if (this._siteId !== -1) {
      this._socket.emit(message, data);
      return true;
    }
    return false;
  }
}

const API_BASE_URL = 'http://127.0.0.1:3000';
const socket = io(API_BASE_URL);

new DocumentController(document.querySelector('#woot-document')!, socket);
