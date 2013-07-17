let EXPORTED_SYMBOLS = [ "common" ];

Components.utils.import("resource://gre/modules/Services.jsm");

let common = {
    authKey : null,
    autoComplete : [],
    prefBranch : Services.prefs.getBranch("extensions.dfki.FireTag."),
    LOG : function(message) {
        if (this.prefBranch.getBoolPref("debug")) {
            dump((new Date().toISOString()) + " [FireTag] " + message + "\n");
        }
    }
};