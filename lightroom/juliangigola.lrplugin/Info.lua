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
  VERSION = { major = 1, minor = 1, revision = 0, build = 0 },
}
