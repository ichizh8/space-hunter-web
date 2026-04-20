// Action registry — maps string action IDs to handler functions.
// Actions are fired by interactables and triggers. Unknown actions get a
// visible placeholder handler so authors see the pipeline working before
// real handlers exist.

export type ActionContext = Record<string, unknown>;
export type ActionHandler = (args: string | undefined, ctx: ActionContext) => void;

const handlers = new Map<string, ActionHandler>();

export function registerAction(id: string, fn: ActionHandler): void {
  handlers.set(id, fn);
}

export function unregisterAction(id: string): void {
  handlers.delete(id);
}

export function hasAction(id: string): boolean {
  return handlers.has(id);
}

// Actions are expressed as "id" or "id:args" strings.
export function dispatchAction(fullAction: string, ctx: ActionContext): void {
  const colon = fullAction.indexOf(':');
  const id = colon < 0 ? fullAction : fullAction.slice(0, colon);
  const args = colon < 0 ? undefined : fullAction.slice(colon + 1);
  const fn = handlers.get(id);
  if (!fn) {
    console.warn(`[actions] unknown action: ${id}`);
    return;
  }
  fn(args, ctx);
}

// Install placeholder handlers for any action IDs not yet implemented.
// Shows an alert so it's obvious the wiring is live.
export function installPlaceholderActions(actionIds: Iterable<string>): void {
  for (const id of actionIds) {
    if (id === 'noop' || handlers.has(id)) continue;
    handlers.set(id, (args) => {
      const label = args ? `${id}:${args}` : id;
      alert(`[placeholder action] ${label}`);
    });
  }
}

// For tests / reload: drop everything.
export function resetRegistry(): void {
  handlers.clear();
}
