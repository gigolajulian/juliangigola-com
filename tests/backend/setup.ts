import { beforeEach } from "vitest";
import { net, resetBreakers } from "@/lib/net";

// Outbound retries wait no wall time in tests, and no test inherits another's failing hosts.
net.baseMs = 0;
beforeEach(() => resetBreakers());
