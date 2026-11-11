-- Plug-in Extras > Check for picks. Runs off the main thread, so Lightroom never waits on the site.
require("ProofsServiceProvider").runCheck()
