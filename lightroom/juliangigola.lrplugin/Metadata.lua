--[[
  This plugin's own fields on each photo, filled by Sync with proof, so the
  Library Filter (Metadata > juliangigola.com) and smart collections can find
  a client's picks and notes. Read-only: the site is where they change.
  Shown in the Metadata panel under the juliangigola.com tagset (Tagset.lua).
]]

return {
  metadataFieldsForPhotos = {
    { id = "clientGallery", title = "Client gallery", dataType = "string", readOnly = true, searchable = true, browsable = true },
    { id = "clientPick", title = "Client pick", dataType = "string", readOnly = true, searchable = true, browsable = true },
    { id = "clientNote", title = "Client note", dataType = "string", readOnly = true, searchable = true },
  },
  schemaVersion = 1,
}
