// Session metadata is read locally; this helper never queries tables or changes auth.
export default function createSessionCacheBoundary(onInvalidate) {
  let activeClient = null;
  let subscription = null;
  let userId = null;
  let generation = 0;
  let sessionRead = null;
  const invalidate = () => { generation++; onInvalidate(); };
  const updateUser = (session, force = false) => {
    const nextId = session?.user?.id || null;
    if (force || nextId !== userId) { userId = nextId; invalidate(); }
  };
  return {
    async enter(client) {
      if (client !== activeClient) {
        subscription?.unsubscribe();
        activeClient = client;
        sessionRead = null;
        userId = null;
        invalidate();
        subscription = client?.auth?.onAuthStateChange?.((event, session) => {
          if (activeClient === client && event !== "INITIAL_SESSION") updateUser(session, event === "SIGNED_OUT" || event === "USER_UPDATED");
        })?.data?.subscription || null;
      }
      if (sessionRead) return sessionRead;
      const before = generation;
      const request = Promise.resolve().then(() => client.auth.getSession()).then(({ data, error }) => {
        if (client !== activeClient || before !== generation || error) return null;
        updateUser(data?.session);
        const captured = generation;
        return { isCurrent: () => activeClient === client && generation === captured };
      }).catch(() => null).finally(() => { if (sessionRead === request) sessionRead = null; });
      sessionRead = request;
      return request;
    },
    dispose() {
      subscription?.unsubscribe();
      subscription = null;
      activeClient = null;
      sessionRead = null;
      userId = null;
      invalidate();
    }
  };
}
