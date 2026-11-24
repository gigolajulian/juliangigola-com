import * as React from "react";
import { unreadCount } from "@/components/admin/admin-inbox";

/* Unread enquiries, on the Inbox tab, so a new one is seen from whatever
   tab is open (`editor.tsx`). Asked when the page opens and again whenever
   the window comes back into focus; the Inbox itself keeps it current while
   open, through the setter. */
export function useUnread() {
  const [unread, setUnread] = React.useState(0);
  React.useEffect(() => {
    const ask = () =>
      void unreadCount().then((n) => {
        if (n !== null) setUnread(n);
      });
    ask();
    window.addEventListener("focus", ask);
    return () => window.removeEventListener("focus", ask);
  }, []);
  return [unread, setUnread] as const;
}
