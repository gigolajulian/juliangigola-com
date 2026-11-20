return {
  LrSdkVersion = 12.0,
  LrSdkMinimumVersion = 6.0,
  LrToolkitIdentifier = "com.juliangigola.export",
  LrPluginName = "juliangigola.com",
  -- Website: File > Export into a portfolio project. Client proofs: a
  -- publish service, one collection per private gallery. Client finals:
  -- a second publish service into the same gallery.
  -- Append only: Lightroom numbers services by order, and the proofs must stay ".2".
  LrExportServiceProvider = {
    { title = "juliangigola.com", file = "ExportServiceProvider.lua" },
    { title = "Client Gallery", file = "ProofsServiceProvider.lua" },
    { title = "Client Delivery", file = "DeliveryServiceProvider.lua" },
  },
  -- Library and File > Plug-in Extras, and a button in Plug-in Manager: pull client picks without publishing.
  LrLibraryMenuItems = {
    { title = "Sync with proof", file = "CheckPicks.lua" },
    { title = "Make delivery from selects", file = "MakeDelivery.lua" },
    { title = "Deliver collection set", file = "DeliverSet.lua" },
    { title = "Sync galleries with site", file = "SyncGalleries.lua" },
  },
  LrExportMenuItems = {
    { title = "Sync with proof", file = "CheckPicks.lua" },
    { title = "Make delivery from selects", file = "MakeDelivery.lua" },
    { title = "Deliver collection set", file = "DeliverSet.lua" },
    { title = "Sync galleries with site", file = "SyncGalleries.lua" },
  },
  -- Client fields on each photo (Client gallery, pick, note), filled by Sync with proof.
  LrMetadataProvider = "Metadata.lua",
  LrMetadataTagsetFactory = "Tagset.lua",
  -- lightroom://com.juliangigola.export/sync?token=<gallery> from the /admin Proofs desk.
  URLHandler = "Link.lua",
  LrPluginInfoProvider = "PluginInfo.lua",
  -- Updates itself from the repo at each start (Update.lua).
  LrInitPlugin = "Init.lua",
  -- Bump revision with every plugin change: Update.lua only installs a higher version.
  VERSION = { major = 1, minor = 2, revision = 12, build = 0 },
}
