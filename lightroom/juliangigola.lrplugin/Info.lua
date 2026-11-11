return {
  LrSdkVersion = 12.0,
  LrSdkMinimumVersion = 6.0,
  LrToolkitIdentifier = "com.juliangigola.export",
  LrPluginName = "juliangigola.com",
  -- Website: File > Export into a portfolio project. Client proofs: a
  -- publish service, one collection per private gallery.
  LrExportServiceProvider = {
    { title = "juliangigola.com", file = "ExportServiceProvider.lua" },
    { title = "Client Gallery", file = "ProofsServiceProvider.lua" },
  },
  -- Library and File > Plug-in Extras, and a button in Plug-in Manager: pull client picks without publishing.
  LrLibraryMenuItems = {
    { title = "Check for picks", file = "CheckPicks.lua" },
  },
  LrExportMenuItems = {
    { title = "Check for picks", file = "CheckPicks.lua" },
  },
  LrPluginInfoProvider = "PluginInfo.lua",
  VERSION = { major = 1, minor = 2, revision = 2, build = 0 },
}
