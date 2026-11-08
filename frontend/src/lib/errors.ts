/**
 * An error whose message the user should see, as a TRANSLATION KEY (not a
 * sentence). Lib code stays language-free: it throws `new UserError('err-…')`
 * and `AppContext` shows `t(key)` in the active language via <ErrorBanner/>.
 */
export class UserError extends Error {
  constructor(readonly key: string) {
    super(key);
    this.name = 'UserError';
  }
}
